const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://www.eff.org/files/2016/09/08/eff_short_wordlist_1.txt';
const outputPath = path.join(__dirname, '../utils/wordlist.ts');

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Parse EFF format: "1111 acme"
    const words = data.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.split('\t')[1]) // split by tab
      .filter(word => word);
    
    const tsContent = `// EFF Short Wordlist 1\nexport const EFF_WORDLIST: string[] = ${JSON.stringify(words, null, 2)};\n`;
    fs.writeFileSync(outputPath, tsContent);
    console.log('Wordlist generated successfully with ' + words.length + ' words.');
  });
}).on('error', (err) => {
  console.error('Error downloading:', err);
});
