import fs from 'fs';
import path from 'path';
import { TemplateEngine } from '@js-template-engine/core';
import config from './template.config';

async function build() {
  const engine = new TemplateEngine(config.extensions);

  const files = fs.readdirSync(config.input).filter(f => /\.(json|ts)$/.test(f));

  for (const file of files) {
    const fullPath = path.join(config.input, file);
    const name = path.basename(file, path.extname(file));
    
    let template;
    if (file.endsWith('.json')) {
      template = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } else {
      template = require(fullPath);
      template = template.default ?? template;
    }

    await engine.render(template, {
      name,
      ...config.globalOptions,
      outputDir: config.output,
    });

    console.log(`✅ Rendered: ${name}`);
  }

  console.log('🏁 All templates rendered.');
}

build().catch((e) => {
  console.error('❌ Build failed', e);
  process.exit(1);
}); 