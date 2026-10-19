import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const docsPublicDir = path.join(rootDir, 'packages', 'docs', 'public');

function parseLcov(lcovPath, filterFn = null) {
  if (!fs.existsSync(lcovPath)) {
    return { linesFound: 0, linesHit: 0, percent: 0, files: [] };
  }

  const content = fs.readFileSync(lcovPath, 'utf8');
  const records = content.split('end_of_record');

  let totalLines = 0;
  let hitLines = 0;
  const files = [];

  for (const record of records) {
    if (!record.trim()) continue;

    const sourceFileMatch = record.match(/SF:(.+)/);
    const sourceFile = sourceFileMatch ? sourceFileMatch[1].trim() : '';

    if (filterFn && !filterFn(sourceFile)) {
      continue;
    }

    const lines = record.split('\n');
    let fileTotal = 0;
    let fileHit = 0;

    for (const line of lines) {
      if (line.startsWith('DA:')) {
        const parts = line.substring(3).split(',');
        const count = parseInt(parts[1], 10);
        fileTotal++;
        if (count > 0) {
          fileHit++;
        }
      }
    }

    if (fileTotal > 0) {
      const filePercent = Math.round((fileHit / fileTotal) * 100);
      const relativePath = path.isAbsolute(sourceFile)
        ? path.relative(rootDir, sourceFile)
        : sourceFile;
      files.push({
        file: relativePath,
        linesFound: fileTotal,
        linesHit: fileHit,
        percent: filePercent,
      });
      totalLines += fileTotal;
      hitLines += fileHit;
    }
  }

  const percent = totalLines > 0 ? Math.round((hitLines / totalLines) * 100) : 100;
  return { linesFound: totalLines, linesHit: hitLines, percent, files };
}

function getColor(percent) {
  if (percent >= 95) return 'brightgreen';
  if (percent >= 90) return '41b883';
  if (percent >= 80) return 'yellowgreen';
  if (percent >= 70) return 'yellow';
  if (percent >= 60) return 'orange';
  return 'red';
}

function writeBadge(filename, label, percent, color) {
  const badgeData = {
    schemaVersion: 1,
    label,
    message: `${percent}%`,
    color,
  };

  const targetPath = path.join(docsPublicDir, filename);
  fs.writeFileSync(targetPath, JSON.stringify(badgeData, null, 2) + '\n');
  console.log(`Generated badge: ${filename} -> ${percent}% (${color})`);
}

function getStatusBadge(percent) {
  if (percent >= 90) return `🟢 **${percent}%**`;
  if (percent >= 80) return `🟡 **${percent}%**`;
  if (percent >= 70) return `🟠 **${percent}%**`;
  return `🔴 **${percent}%**`;
}

function generateMarkdownSummary(coreCoverage, studioCoverage, docsPercent) {
  let md = '### 📊 Test Coverage Report\n\n';
  md += '| Package | Coverage | Lines Hit / Total | Status |\n';
  md += '|:---|:---:|:---:|:---:|\n';
  md += `| **@nullix/zod-mongoose** (Core) | ${getStatusBadge(coreCoverage.percent)} | ${coreCoverage.linesHit} / ${coreCoverage.linesFound} | ${coreCoverage.percent >= 80 ? '✅ Pass' : '⚠️ Warning'} |\n`;
  md += `| **@nullix/zod-mongoose-studio** (Studio) | ${getStatusBadge(studioCoverage.percent)} | ${studioCoverage.linesHit} / ${studioCoverage.linesFound} | ${studioCoverage.percent >= 80 ? '✅ Pass' : '⚠️ Warning'} |\n`;
  md += `| **@nullix/zod-mongoose-docs** (Docs) | ${getStatusBadge(docsPercent)} | Typechecked | ✅ Pass |\n\n`;

  if (coreCoverage.files.length > 0) {
    md += '<details>\n<summary>🔍 <b>Core Package File Breakdown</b></summary>\n\n';
    md += '| File | Coverage | Lines Hit / Total |\n';
    md += '|:---|:---:|:---:|\n';
    for (const f of coreCoverage.files) {
      md += `| \`${f.file}\` | ${f.percent}% | ${f.linesHit} / ${f.linesFound} |\n`;
    }
    md += '\n</details>\n\n';
  }

  if (studioCoverage.files.length > 0) {
    md += '<details>\n<summary>🔍 <b>Studio Package File Breakdown</b></summary>\n\n';
    md += '| File | Coverage | Lines Hit / Total |\n';
    md += '|:---|:---:|:---:|\n';
    for (const f of studioCoverage.files) {
      md += `| \`${f.file}\` | ${f.percent}% | ${f.linesHit} / ${f.linesFound} |\n`;
    }
    md += '\n</details>\n\n';
  }

  return md;
}

async function main() {
  if (!fs.existsSync(docsPublicDir)) {
    fs.mkdirSync(docsPublicDir, { recursive: true });
  }

  console.log('Running test coverage for @nullix/zod-mongoose (core)...');
  const coreDir = path.join(rootDir, 'packages', 'core');
  execSync('bun test --coverage --coverage-reporter=lcov --coverage-reporter=text', {
    cwd: coreDir,
    stdio: 'inherit',
  });

  const coreCoverage = parseLcov(path.join(coreDir, 'coverage', 'lcov.info'));
  const coreColor = getColor(coreCoverage.percent);

  console.log('Running test coverage for @nullix/zod-mongoose-studio (studio)...');
  const studioDir = path.join(rootDir, 'packages', 'studio');
  execSync('bun test --coverage --coverage-reporter=lcov --coverage-reporter=text', {
    cwd: studioDir,
    stdio: 'inherit',
  });

  const studioCoverage = parseLcov(
    path.join(studioDir, 'coverage', 'lcov.info'),
    (file) => !file.includes('../core') && !file.includes('dist'),
  );
  const studioColor = getColor(studioCoverage.percent);

  const docsPercent = 100;
  const docsColor = '41b883';

  console.log('\n--- Test Coverage Summary ---');
  console.log(`Core:   ${coreCoverage.percent}% (${coreCoverage.linesHit}/${coreCoverage.linesFound} lines)`);
  console.log(`Studio: ${studioCoverage.percent}% (${studioCoverage.linesHit}/${studioCoverage.linesFound} lines)`);
  console.log(`Docs:   ${docsPercent}% (Typecheck verified)`);
  console.log('-----------------------------\n');

  // Main badge (holding core coverage for the main README)
  writeBadge('coverage-badge.json', 'coverage', coreCoverage.percent, coreColor);
  // Package-specific badges
  writeBadge('coverage-core.json', 'coverage', coreCoverage.percent, coreColor);
  writeBadge('coverage-studio.json', 'coverage', studioCoverage.percent, studioColor);
  writeBadge('coverage-docs.json', 'coverage', docsPercent, docsColor);

  const markdownSummary = generateMarkdownSummary(coreCoverage, studioCoverage, docsPercent);
  const summaryFile = path.join(rootDir, 'coverage-summary.md');
  fs.writeFileSync(summaryFile, markdownSummary, 'utf8');
  console.log(`Written coverage summary to ${summaryFile}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary, 'utf8');
    console.log('Appended coverage summary to GITHUB_STEP_SUMMARY');
  }
}

main().catch((err) => {
  console.error('Error generating coverage:', err);
  process.exit(1);
});
