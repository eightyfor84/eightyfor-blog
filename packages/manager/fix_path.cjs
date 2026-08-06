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

  content = content.replace("from '@/utils/fetchWithAuth'", "from '../../utils/fetchWithAuth'");
  if (file === "src/App.vue") {
      content = content.replace("from '../../utils/fetchWithAuth'", "from './utils/fetchWithAuth'");
  } else if (file.includes("src/components/")) {
       content = content.replace("from '../../utils/fetchWithAuth'", "from '../utils/fetchWithAuth'");
  } else if (file.includes("src/pages/settings/")) {
        // keep ../../
  } else if (file.includes("src/pages/")) {
       content = content.replace("from '../../utils/fetchWithAuth'", "from '../utils/fetchWithAuth'");
  }

  // quick fix type error 
  content = content.replace(".then(r => r.ok", ".then((r: any) => r.ok");

  fs.writeFileSync(fullPath, content, 'utf8');
}
