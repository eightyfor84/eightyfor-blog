const fs = require('fs');
const path = require('path');

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
  const fullPath = path.join('/opt/Chronicle/chronicle-frontend', file);
  let content = fs.readFileSync(fullPath, 'utf8');

  if (content.includes('fetchWithAuth')) {
      if (!content.includes('import { fetchWithAuth }')) {
            content = content.replace(/<script setup[^>]*>/, match => `${match}\nimport { fetchWithAuth } from '@/utils/fetchWithAuth';`);
            fs.writeFileSync(fullPath, content, 'utf8');
      }
  }
}
