const fs = require('fs');

const fixFile = (p) => {
    let text = fs.readFileSync(p, 'utf8');
     text = text.replace("import { fetchWithAuth } from '@/utils/fetchWithAuth'", "import { fetchWithAuth } from '../../utils/fetchWithAuth'");
    fs.writeFileSync(p, text);
}

const fixFile2 = (p) => {
    let text = fs.readFileSync(p, 'utf8');
     text = text.replace("import { fetchWithAuth } from '@/utils/fetchWithAuth'", "import { fetchWithAuth } from '../utils/fetchWithAuth'");
    fs.writeFileSync(p, text);
}
const fixFile3 = (p) => {
    let text = fs.readFileSync(p, 'utf8');
     text = text.replace(".then(r => r.ok", ".then((r: any) => r.ok");
    fs.writeFileSync(p, text);
}
try { fixFile3("/opt/Chronicle/chronicle-frontend/src/pages/settings/SettingsAppearance.vue"); } catch(e){}

try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/Dashboard.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/Traffic.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/Security.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/PostManager.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/Login.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/SettingsBuild.vue"); } catch(e){}
try { fixFile2("/opt/Chronicle/chronicle-frontend/src/pages/FileManager.vue"); } catch(e){}

