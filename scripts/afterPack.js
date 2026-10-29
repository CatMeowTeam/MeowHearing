// Gắn icon + thông tin phiên bản vào file .exe (thay rcedit/wine khi build trên Linux)
const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const name = ctx.packager.appInfo.productFilename + '.exe';
  const exePath = path.join(ctx.appOutDir, name);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map(i => i.data));

  const version = ctx.packager.appInfo.version;
  const [a, b, c] = version.split('.').map(n => parseInt(n, 10) || 0);
  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = vis[0] || ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(a, b, c, 0, 1033);
  vi.setProductVersion(a, b, c, 0, 1033);
  const langs = vi.getAllLanguagesForStringValues();
  const target = langs.length ? langs : [{ lang: 1033, codepage: 1200 }];
  for (const l of target) {
    vi.setStringValues(l, {
      CompanyName: 'CatMeow Team',
      FileDescription: 'Meow Hearing',
      ProductName: 'Meow Hearing',
      LegalCopyright: '© 2026 CatMeow Team',
      OriginalFilename: name,
      InternalName: 'Meow Hearing',
      FileVersion: version,
      ProductVersion: version + ' Beta',
    });
  }
  vi.outputToResourceEntries(res.entries);
  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log('  • resedit: đã gắn icon + version vào', name);
};
