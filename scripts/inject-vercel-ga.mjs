import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const measurementId = process.env.GA_MEASUREMENT_ID?.trim()
const isVercelProduction = process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production'
const distIndexPath = path.resolve(process.cwd(), 'dist/index.html')

if (!isVercelProduction) {
  console.log('Skipping Google Analytics injection outside Vercel production builds.')
  process.exit(0)
}

if (!measurementId) {
  console.log('Skipping Google Analytics injection because GA_MEASUREMENT_ID is not set.')
  process.exit(0)
}

if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
  console.error(`Invalid GA_MEASUREMENT_ID: ${measurementId}`)
  process.exit(1)
}

const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
const analyticsSnippet = [
  `    <script async src="${gtagSrc}"></script>`,
  '    <script>',
  '      window.dataLayer = window.dataLayer || [];',
  '      function gtag(){dataLayer.push(arguments);}',
  "      gtag('js', new Date());",
  '',
  `      gtag('config', '${measurementId}');`,
  '    </script>',
].join('\n')

const indexHtml = await readFile(distIndexPath, 'utf8')

if (indexHtml.includes(gtagSrc)) {
  console.log('Google Analytics snippet already present in dist/index.html.')
  process.exit(0)
}

if (!indexHtml.includes('</head>')) {
  console.error('Unable to inject Google Analytics because </head> was not found in dist/index.html.')
  process.exit(1)
}

const nextHtml = indexHtml.replace(/\s*<\/head>/, `\n${analyticsSnippet}\n  </head>`)
await writeFile(distIndexPath, nextHtml, 'utf8')

console.log(`Injected Google Analytics for ${measurementId} into dist/index.html.`)
