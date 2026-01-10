const fs = require('fs');

function escapeTemplate(content) {
  return content.replace(/`/g, '\\`').replace(/\${/g, '\\${');
}

const files = [
  { name: 'terms-of-service', en: 'terms-of-service.en.md', pt: 'terms-of-service.pt.md' },
  { name: 'privacy-policy', en: 'privacy-policy.en.md', pt: null },
  { name: 'platform-rules', en: 'platform-rules.en.md', pt: null },
  { name: 'cookies', en: 'cookies.en.md', pt: null }
];

files.forEach(({ name, en, pt }) => {
  const constName = name.toUpperCase().replace(/-/g, '_');
  
  // Read EN version
  const enContent = fs.readFileSync(en, 'utf8');
  const enEscaped = escapeTemplate(enContent);
  const enTs = `export const ${constName}_EN = \`${enEscaped}\`;`;
  fs.writeFileSync(`${name}.en.ts`, enTs);
  console.log(`✓ Created ${name}.en.ts`);
  
  // Read PT version if exists
  if (pt && fs.existsSync(pt)) {
    const ptContent = fs.readFileSync(pt, 'utf8');
    const ptEscaped = escapeTemplate(ptContent);
    const ptTs = `export const ${constName}_PT = \`${ptEscaped}\`;`;
    fs.writeFileSync(`${name}.pt.ts`, ptTs);
    console.log(`✓ Created ${name}.pt.ts`);
  }
});

console.log('\n✓ Conversion complete!');

