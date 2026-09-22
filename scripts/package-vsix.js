const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const staging = path.join(root, ".vsix-staging");
const outVsix = path.join(root, `${pkg.name}-${pkg.version}.vsix`);

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.join(staging, "extension"), { recursive: true });

const copyList = [
  "package.json",
  "readme.md",
  "README.md",
  "LICENSE.txt",
  "prreviewer.png",
  "out",
  "prompt",
  "skills",
  "media",
  "settings.example.json",
];

for (const item of copyList) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(staging, "extension", item === "readme.md" ? "README.md" : item);
  fs.cpSync(src, dest, { recursive: true });
}

const manifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="${pkg.name}" Version="${pkg.version}" Publisher="${pkg.publisher}" />
    <DisplayName>${pkg.displayName}</DisplayName>
    <Description xml:space="preserve">${pkg.description}</Description>
    <Tags></Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="${pkg.engines.vscode}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
    <Icon>extension/prreviewer.png</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE.txt" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/prreviewer.png" Addressable="true" />
  </Assets>
</PackageManifest>
`;

const contentTypes = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
</Types>
`;

fs.writeFileSync(path.join(staging, "extension.vsixmanifest"), manifest);
fs.writeFileSync(path.join(staging, "[Content_Types].xml"), contentTypes);

if (fs.existsSync(outVsix)) fs.unlinkSync(outVsix);

const zipPath = outVsix.replace(/\.vsix$/, ".zip");
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: "inherit" }
);
fs.renameSync(zipPath, outVsix);
try {
  fs.rmSync(staging, { recursive: true, force: true });
} catch {
  /* Windows EBUSY — vsix zaten yazildi */
}
console.log("Created", outVsix);
