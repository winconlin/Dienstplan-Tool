const esbuild = require('esbuild');
const fs = require('fs');
const { execSync } = require('child_process');
const { JSDOM } = require('jsdom');

async function build() {
    console.log('Building JavaScript...');
    const result = await esbuild.build({
        entryPoints: ['scripts/app-init.js'],
        bundle: true,
        minify: true,
        write: false,
        format: 'iife',
    });
    const jsContent = result.outputFiles[0].text;

    console.log('Building CSS (Tailwind)...');
    execSync('npx tailwindcss -i ./input.css -o ./dist.css --minify');
    const tailwindCssContent = fs.readFileSync('dist.css', 'utf8');
    const customCssContent = fs.readFileSync('styles.css', 'utf8');
    const finalCss = tailwindCssContent + '\n' + customCssContent;

    console.log('Generating inline HTML...');
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;

    // Remove old scripts and CSS links
    Array.from(document.querySelectorAll('script')).forEach(s => s.remove());
    Array.from(document.querySelectorAll('link[rel="stylesheet"]')).forEach(l => l.remove());

    // Inject compiled CSS
    const styleTag = document.createElement('style');
    styleTag.textContent = finalCss;
    document.head.appendChild(styleTag);

    // Inject bundled JS
    const scriptTag = document.createElement('script');
    scriptTag.textContent = jsContent;
    document.body.appendChild(scriptTag);

    fs.writeFileSync('Dienstplan.html', dom.serialize());

    // Clean up
    fs.unlinkSync('dist.css');

    console.log('Build complete: Dienstplan.html generated.');
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
