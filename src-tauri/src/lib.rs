use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

// ========== 数据结构 ==========

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub email: String,
    pub name: String,
    pub profile_dir: String,
}

// ========== 辅助函数 ==========

/// 获取 tags.json 的路径
fn tags_file_path() -> PathBuf {
    let app_data = if cfg!(target_os = "macos") {
        env::var("HOME")
            .map(|h| PathBuf::from(h).join("Library/Application Support/chrome-launcher"))
            .unwrap_or_else(|_| PathBuf::from("."))
    } else {
        env::var("APPDATA")
            .map(|a| PathBuf::from(a).join("chrome-launcher"))
            .unwrap_or_else(|_| PathBuf::from("."))
    };
    let _ = std::fs::create_dir_all(&app_data);
    app_data.join("tags.json")
}

/// 获取 Chrome User Data 目录下的 Local State 文件路径
fn local_state_path() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        let home = env::var("HOME").ok()?;
        Some(PathBuf::from(home).join("Library/Application Support/Google/Chrome/Local State"))
    } else {
        let local_app_data = env::var("LOCALAPPDATA").ok()?;
        Some(PathBuf::from(local_app_data).join("Google\\Chrome\\User Data\\Local State"))
    }
}

/// 检测 Chrome 安装路径
fn find_chrome() -> Option<String> {
    if cfg!(target_os = "macos") {
        let candidates = vec![
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".to_string(),
        ];
        for c in candidates {
            if PathBuf::from(&c).is_file() {
                return Some(c);
            }
        }
    } else {
        let program_files = env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
        let program_files_x86 =
            env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".into());
        let candidates = vec![
            format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files),
            format!("{}\\Google\\Chrome\\Application\\chrome.exe", program_files_x86),
        ];
        for c in candidates {
            if PathBuf::from(&c).is_file() {
                return Some(c);
            }
        }
    }
    None
}

// ========== Tauri Commands ==========

#[tauri::command]
fn detect_chrome() -> Result<String, String> {
    find_chrome().ok_or_else(|| "未检测到 Chrome，请手动选择".into())
}

#[tauri::command]
fn get_profiles() -> Result<Vec<Profile>, String> {
    let path = local_state_path().ok_or("无法确定 Chrome 配置目录")?;
    if !path.is_file() {
        return Err(format!("找不到 Chrome 配置文件: {}", path.display()));
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {}", e))?;
    let data: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 JSON 失败: {}", e))?;
    let info_cache = data
        .get("profile")
        .and_then(|p| p.get("info_cache"))
        .and_then(|c| c.as_object())
        .ok_or("配置文件格式异常")?;

    let mut profiles: Vec<Profile> = info_cache
        .iter()
        .map(|(dir, info)| Profile {
            email: info.get("user_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: info.get("gaia_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            profile_dir: dir.clone(),
        })
        .collect();
    profiles.sort_by(|a, b| a.email.to_lowercase().cmp(&b.email.to_lowercase()));
    Ok(profiles)
}

#[tauri::command]
fn launch_chrome(chrome_path: String, profile_dir: String) -> Result<String, String> {
    Command::new(&chrome_path)
        .arg(format!("--profile-directory={}", profile_dir))
        .spawn()
        .map_err(|e| format!("启动 Chrome 失败: {}", e))?;
    Ok("启动成功".into())
}

/// 在指定 Profile 的 Chrome 中打开额度页面
#[tauri::command]
fn open_quota_page(chrome_path: String, profile_dir: String) -> Result<String, String> {
    Command::new(&chrome_path)
        .arg(format!("--profile-directory={}", profile_dir))
        .arg("https://one.google.com/ai/activity")
        .spawn()
        .map_err(|e| format!("打开额度页面失败: {}", e))?;
    Ok("已打开额度页面".into())
}

#[tauri::command]
fn load_tags() -> Result<HashMap<String, Vec<String>>, String> {
    let path = tags_file_path();
    if !path.is_file() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取标签文件失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析标签文件失败: {}", e))
}

#[tauri::command]
fn save_tags(tags: HashMap<String, Vec<String>>) -> Result<(), String> {
    let path = tags_file_path();
    let cleaned: HashMap<&String, &Vec<String>> =
        tags.iter().filter(|(_, v)| !v.is_empty()).collect();
    let content = serde_json::to_string_pretty(&cleaned).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("保存标签文件失败: {}", e))?;
    Ok(())
}

// ========== 入口 ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_chrome,
            get_profiles,
            launch_chrome,
            open_quota_page,
            load_tags,
            save_tags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
