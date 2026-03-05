// ========== Tauri API ==========
const { invoke } = window.__TAURI__.core;

// ========== 全局状态 ==========
let profiles = [];
let tags = {};         // { profileDir: [tag1, tag2, ...] }
let allTags = [];      // 所有标签去重
let chromePath = '';
let selectedProfileDir = null;

// 标签颜色映射（稳定哈希）
function tagColorClass(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return 'tag-color-' + (Math.abs(hash) % 8);
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  // 恢复主题偏好
  initTheme();

  // 检测 Chrome
  try {
    chromePath = await invoke('detect_chrome');
    document.getElementById('chromePathValue').textContent = chromePath;
    document.getElementById('chromePathValue').style.color = 'var(--text-secondary)';
  } catch (e) {
    document.getElementById('chromePathValue').textContent = e;
    document.getElementById('chromePathValue').style.color = 'var(--danger)';
  }

  // 加载标签
  try {
    tags = await invoke('load_tags');
  } catch (e) {
    console.error('加载标签失败:', e);
    tags = {};
  }

  // 加载 profiles
  await loadProfiles();

  // 事件绑定
  bindEvents();
});

// ========== 数据加载 ==========
async function loadProfiles() {
  try {
    profiles = await invoke('get_profiles');
    updateAllTags();
    renderTable();
    setStatus(`共 ${profiles.length} 个账号`);
  } catch (e) {
    setStatus('加载失败: ' + e);
  }
}

function updateAllTags() {
  const tagSet = new Set();
  Object.values(tags).forEach(list => list.forEach(t => tagSet.add(t)));
  allTags = [...tagSet].sort();

  // 更新筛选下拉框
  const select = document.getElementById('tagFilter');
  const currentVal = select.value;
  select.innerHTML = '<option value="">全部标签</option>';
  allTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// ========== 表格渲染 ==========
function renderTable() {
  const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
  const tagFilterVal = document.getElementById('tagFilter').value;

  const tbody = document.getElementById('accountTableBody');
  const emptyState = document.getElementById('emptyState');

  tbody.innerHTML = '';
  let count = 0;

  profiles.forEach(profile => {
    const profileTags = tags[profile.profile_dir] || [];
    const tagsStr = profileTags.join(' ').toLowerCase();

    // 标签筛选
    if (tagFilterVal && !profileTags.includes(tagFilterVal)) return;

    // 搜索过滤
    if (keyword) {
      const match =
        profile.email.toLowerCase().includes(keyword) ||
        profile.name.toLowerCase().includes(keyword) ||
        tagsStr.includes(keyword);
      if (!match) return;
    }

    const tr = document.createElement('tr');
    tr.dataset.profileDir = profile.profile_dir;
    tr.dataset.email = profile.email;

    // 选中状态
    if (profile.profile_dir === selectedProfileDir) {
      tr.classList.add('selected');
    }

    tr.innerHTML = `
      <td class="email-cell">${escapeHtml(profile.email)}</td>
      <td class="name-cell">${escapeHtml(profile.name)}</td>
      <td>
        <div class="tags-cell" data-dir="${escapeHtml(profile.profile_dir)}" data-email="${escapeHtml(profile.email)}">
          ${profileTags.map(t =>
      `<span class="tag-badge ${tagColorClass(t)}">${escapeHtml(t)}</span>`
    ).join('')}
          <button class="tag-add-btn" data-action="quick-tag" data-dir="${escapeHtml(profile.profile_dir)}" data-email="${escapeHtml(profile.email)}" title="快速添加标签">+</button>
        </div>
      </td>
      <td class="dir-cell">${escapeHtml(profile.profile_dir)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" title="管理标签" data-action="tags" data-dir="${escapeHtml(profile.profile_dir)}" data-email="${escapeHtml(profile.email)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </button>
          <button class="action-btn launch" title="启动" data-action="launch" data-dir="${escapeHtml(profile.profile_dir)}" data-email="${escapeHtml(profile.email)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </button>
        </div>
      </td>
    `;

    // 单击选中
    tr.addEventListener('click', () => {
      selectedProfileDir = profile.profile_dir;
      document.querySelectorAll('.account-table tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
    });

    // 双击启动
    tr.addEventListener('dblclick', () => {
      launchChrome(profile.profile_dir, profile.email);
    });

    // 右键菜单
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedProfileDir = profile.profile_dir;
      document.querySelectorAll('.account-table tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showContextMenu(e.clientX, e.clientY, profile.profile_dir, profile.email);
    });

    tbody.appendChild(tr);
    count++;
  });

  // 空状态
  if (count === 0) {
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
  }

  setStatus(`共 ${profiles.length} 个账号 / 已筛选 ${count} 个`);
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 搜索
  document.getElementById('searchInput').addEventListener('input', () => renderTable());

  // 标签筛选
  document.getElementById('tagFilter').addEventListener('change', () => renderTable());

  // 刷新
  document.getElementById('btnRefresh').addEventListener('click', async () => {
    await loadProfiles();
  });

  // 选择 Chrome 路径
  document.getElementById('btnSelectChrome').addEventListener('click', async () => {
    try {
      const { open } = window.__TAURI__.dialog;
      const selected = await open({
        title: '选择 Chrome 可执行文件',
        filters: [{ name: 'Chrome', extensions: ['exe'] }],
        multiple: false,
      });
      if (selected) {
        chromePath = selected;
        document.getElementById('chromePathValue').textContent = chromePath;
        document.getElementById('chromePathValue').style.color = 'var(--text-secondary)';
      }
    } catch (e) {
      console.error('选择文件失败:', e);
    }
  });

  // 底部启动按钮
  document.getElementById('btnLaunch').addEventListener('click', () => {
    if (!selectedProfileDir) {
      setStatus('请先选中一个账号');
      return;
    }
    const profile = profiles.find(p => p.profile_dir === selectedProfileDir);
    if (profile) {
      launchChrome(profile.profile_dir, profile.email);
    }
  });

  // 表格内操作按钮（事件委托）
  document.getElementById('accountTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.dataset.action;
    const dir = btn.dataset.dir;
    const email = btn.dataset.email;
    if (action === 'tags') {
      openTagModal(dir, email);
    } else if (action === 'launch') {
      launchChrome(dir, email);
    } else if (action === 'quick-tag') {
      showQuickTagDropdown(btn, dir, email);
    }
  });

  // 右键菜单项
  document.getElementById('ctxManageTags').addEventListener('click', () => {
    hideContextMenu();
    const dir = document.getElementById('contextMenu').dataset.dir;
    const email = document.getElementById('contextMenu').dataset.email;
    openTagModal(dir, email);
  });

  document.getElementById('ctxLaunch').addEventListener('click', () => {
    hideContextMenu();
    const dir = document.getElementById('contextMenu').dataset.dir;
    const email = document.getElementById('contextMenu').dataset.email;
    launchChrome(dir, email);
  });

  // 点击其他地方关闭右键菜单
  document.addEventListener('click', () => hideContextMenu());

  // 标签弹窗事件
  document.getElementById('btnCloseModal').addEventListener('click', closeTagModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeTagModal);
  document.getElementById('btnSaveModal').addEventListener('click', saveTagsFromModal);
  document.getElementById('btnAddTag').addEventListener('click', addTagFromInput);
  document.getElementById('newTagInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTagFromInput();
  });

  // ESC 关闭弹窗
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTagModal();
      hideContextMenu();
    }
  });

  // 主题切换
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
}

// ========== Chrome 启动 ==========
async function launchChrome(profileDir, email) {
  if (!chromePath) {
    setStatus('Chrome 路径无效，请手动选择');
    return;
  }
  try {
    await invoke('launch_chrome', { chromePath, profileDir });
    setStatus(`已启动: ${email}`);
  } catch (e) {
    setStatus('启动失败: ' + e);
  }
}

// ========== 右键菜单 ==========
function showContextMenu(x, y, profileDir, email) {
  const menu = document.getElementById('contextMenu');
  menu.dataset.dir = profileDir;
  menu.dataset.email = email;
  menu.style.display = 'block';

  // 确保菜单不超出窗口
  const rect = menu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
}

// ========== 快速标签选择下拉 ==========
let quickTagDropdown = null;
let quickTagProfileDir = null;

function showQuickTagDropdown(anchorBtn, profileDir, email) {
  hideQuickTagDropdown();
  quickTagProfileDir = profileDir;

  const dropdown = document.createElement('div');
  dropdown.className = 'quick-tag-dropdown';
  quickTagDropdown = dropdown;

  rebuildDropdownContent(dropdown, profileDir, email);

  document.body.appendChild(dropdown);

  // 定位
  const rect = anchorBtn.getBoundingClientRect();
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';

  // 确保不超出窗口
  requestAnimationFrame(() => {
    const dRect = dropdown.getBoundingClientRect();
    if (dRect.right > window.innerWidth) {
      dropdown.style.left = (window.innerWidth - dRect.width - 8) + 'px';
    }
    if (dRect.bottom > window.innerHeight) {
      dropdown.style.top = (rect.top - dRect.height - 4) + 'px';
    }
  });

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', onClickOutsideQuickTag);
  }, 10);
}

function rebuildDropdownContent(dropdown, profileDir, email) {
  const profileTags = tags[profileDir] || [];

  // 保留输入框焦点值
  const oldInput = dropdown.querySelector('.quick-tag-input-row input');
  const oldVal = oldInput ? oldInput.value : '';

  dropdown.innerHTML = '';

  // 新建标签输入
  const inputRow = document.createElement('div');
  inputRow.className = 'quick-tag-input-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '新标签...';
  input.value = oldVal;
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      if (!val) return;
      e.stopPropagation();
      if (!profileTags.includes(val)) {
        profileTags.push(val);
        tags[profileDir] = profileTags;
        await invoke('save_tags', { tags });
        updateAllTags();
        input.value = '';
        // 原地刷新
        updateTagsCellInline(profileDir);
        rebuildDropdownContent(dropdown, profileDir, email);
        const newInput = dropdown.querySelector('.quick-tag-input-row input');
        if (newInput) newInput.focus();
      }
    } else if (e.key === 'Escape') {
      hideQuickTagDropdown();
    }
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  inputRow.appendChild(input);
  dropdown.appendChild(inputRow);

  // 已有标签列表
  if (allTags.length > 0) {
    allTags.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'quick-tag-item';
      const checked = profileTags.includes(tag);
      item.innerHTML = `
        <span class="quick-tag-check">${checked ? '✓' : ''}</span>
        <span class="tag-badge ${tagColorClass(tag)}">${escapeHtml(tag)}</span>
      `;
      if (checked) item.classList.add('checked');
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = profileTags.indexOf(tag);
        if (idx >= 0) {
          profileTags.splice(idx, 1);
        } else {
          profileTags.push(tag);
        }
        tags[profileDir] = profileTags;
        await invoke('save_tags', { tags });
        updateAllTags();
        // 原地更新，不重建表格
        updateTagsCellInline(profileDir);
        rebuildDropdownContent(dropdown, profileDir, email);
      });
      dropdown.appendChild(item);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'quick-tag-empty';
    empty.textContent = '输入名称创建第一个标签';
    dropdown.appendChild(empty);
  }
}

/** 只更新指定 profileDir 那一行的标签单元格，不重建整个表格 */
function updateTagsCellInline(profileDir) {
  const cell = document.querySelector(`.tags-cell[data-dir="${profileDir}"]`);
  if (!cell) return;
  const profileTags = tags[profileDir] || [];
  const email = cell.dataset.email || '';
  // 保留 + 按钮，只更新标签徽章
  const badges = profileTags.map(t =>
    `<span class="tag-badge ${tagColorClass(t)}">${escapeHtml(t)}</span>`
  ).join('');
  cell.innerHTML = badges +
    `<button class="tag-add-btn" data-action="quick-tag" data-dir="${escapeHtml(profileDir)}" data-email="${escapeHtml(email)}" title="快速添加标签">+</button>`;
}

function onClickOutsideQuickTag(e) {
  if (quickTagDropdown && !quickTagDropdown.contains(e.target)) {
    hideQuickTagDropdown();
  }
}

function hideQuickTagDropdown() {
  if (quickTagDropdown) {
    quickTagDropdown.remove();
    quickTagDropdown = null;
    quickTagProfileDir = null;
    document.removeEventListener('click', onClickOutsideQuickTag);
  }
}

// ========== 标签弹窗 ==========
let modalProfileDir = null;
let modalCurrentTags = [];

function openTagModal(profileDir, email) {
  modalProfileDir = profileDir;
  modalCurrentTags = [...(tags[profileDir] || [])];

  document.getElementById('modalSubtitle').textContent = email;
  document.getElementById('newTagInput').value = '';
  document.getElementById('tagModal').style.display = 'flex';

  renderModalTags();
  renderExistingTags();

  // 自动聚焦输入框
  setTimeout(() => document.getElementById('newTagInput').focus(), 100);
}

function closeTagModal() {
  document.getElementById('tagModal').style.display = 'none';
  modalProfileDir = null;
  modalCurrentTags = [];
}

function renderModalTags() {
  const container = document.getElementById('currentTagsList');
  if (modalCurrentTags.length === 0) {
    container.innerHTML = '<p class="no-tags">暂无标签</p>';
    return;
  }
  container.innerHTML = modalCurrentTags.map((tag, i) => `
    <div class="current-tag-item">
      <span class="tag-name">
        <span class="tag-badge ${tagColorClass(tag)}">${escapeHtml(tag)}</span>
      </span>
      <button class="btn btn-danger btn-sm" onclick="removeModalTag(${i})">删除</button>
    </div>
  `).join('');
}

function renderExistingTags() {
  const available = allTags.filter(t => !modalCurrentTags.includes(t));
  const row = document.getElementById('existingTagsRow');
  const list = document.getElementById('existingTagsList');

  if (available.length === 0) {
    row.style.display = 'none';
    return;
  }

  row.style.display = 'block';
  list.innerHTML = available.map(tag => `
    <button class="existing-tag-btn" onclick="addExistingTag('${escapeHtml(tag)}')">
      + ${escapeHtml(tag)}
    </button>
  `).join('');
}

function addTagFromInput() {
  const input = document.getElementById('newTagInput');
  const tag = input.value.trim();
  if (!tag) return;
  if (modalCurrentTags.includes(tag)) {
    setStatus(`标签「${tag}」已存在`);
    return;
  }
  modalCurrentTags.push(tag);
  input.value = '';
  renderModalTags();
  renderExistingTags();
}

// 全局函数供 onclick 使用
window.addExistingTag = function (tag) {
  if (modalCurrentTags.includes(tag)) return;
  modalCurrentTags.push(tag);
  renderModalTags();
  renderExistingTags();
};

window.removeModalTag = function (index) {
  modalCurrentTags.splice(index, 1);
  renderModalTags();
  renderExistingTags();
};

async function saveTagsFromModal() {
  if (modalProfileDir === null) return;

  tags[modalProfileDir] = [...modalCurrentTags];

  // 清理空标签的 key
  Object.keys(tags).forEach(k => {
    if (tags[k].length === 0) delete tags[k];
  });

  try {
    await invoke('save_tags', { tags });
    setStatus('标签已保存');
  } catch (e) {
    setStatus('保存失败: ' + e);
  }

  updateAllTags();
  renderTable();
  closeTagModal();
}

// ========== 工具函数 ==========
function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== 主题切换 ==========
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);

  const moonIcon = document.querySelector('.icon-moon');
  const sunIcon = document.querySelector('.icon-sun');
  if (theme === 'light') {
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'block';
  } else {
    moonIcon.style.display = 'block';
    sunIcon.style.display = 'none';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
}
