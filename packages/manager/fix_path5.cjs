const fs = require('fs');

const filesToFix = [
  "src/archive/pages/Search.vue",
  "src/archive/pages/BlogPost.vue",
  "src/archive/pages/BlogList.vue",
  "src/pages/FileManager.vue",
  "src/pages/Login.vue",
  "src/pages/settings/SettingsAppearance.vue",
  "src/pages/SettingsBuild.vue",
  "src/pages/Dashboard.vue",
  "src/pages/Traffic.vue",
  "src/pages/Security.vue",
  "src/pages/PostManager.vue",
  "src/App.vue",
  "src/components/FilePreviewModal.vue",
  "src/components/BlogEditor.vue"
];

for (const file of filesToFix) {
  const fullPath = '/opt/Chronicle/chronicle-frontend/' + file;
  let content = fs.readFileSync(fullPath, 'utf8');

  content = content.replace(/import \{ fetchWithAuth \} from '';\n/g, "");
  content = content.replace(/import \{ fetchWithAuth \} from '.*';\n/g, "");

  let relativePath = '';
  if (file === 'src/App.vue') {
    relativePath = './utils/fetchWithAuth';
  } else if (file.startsWith('src/archive/pages/')) {
      relativePath = '../../utils/fetchWithAuth';
  } else if (file.startsWith('src/components/')) {
    relativePath = '../utils/fetchWithAuth';
  } else if (file.includes('settings/')) {
    relativePath = '../../utils/fetchWithAuth';
  } else if (file.startsWith('src/pages/')) {
      relativePath = '../utils/fetchWithAuth';
  }

  content = content.replace(/<script setup[^>]*>/, match => `${match}\nimport { fetchWithAuth } from '${relativePath}';`);
  
  if (file === 'src/pages/settings/SettingsAppearance.vue') {
      content = content.replace('.then(r => r.ok', '.then((r: any) => r.ok');
  }

  fs.writeFileSync(fullPath, content, 'utf8');
}
