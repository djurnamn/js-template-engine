#!/usr/bin/env node

import { InitCommand } from './packages/create-ui-kit/dist/commands/init.js';
import fs from 'fs-extra';

async function testBemInit() {
  const targetDir = '/tmp/test-bem-ui-kit';
  
  // Clean up
  if (await fs.pathExists(targetDir)) {
    await fs.remove(targetDir);
  }

  console.log('🧪 Testing BEM integration...\n');

  const initCommand = new InitCommand();
  
  try {
    await initCommand.execute({
      name: 'test-bem-ui-kit',
      frameworks: ['react'],
      styling: ['css', 'bem'], // Include BEM
      typescript: true,
      outputDir: '/tmp'
    });

    console.log('✅ Project created successfully!\n');

    // Check the config file
    const configPath = `${targetDir}/create-ui-kit.config.js`;
    if (await fs.pathExists(configPath)) {
      console.log('📋 Configuration file exists');
      const configContent = await fs.readFile(configPath, 'utf-8');
      console.log('BEM in config:', configContent.includes('bem'));
      
      // Show relevant part of config
      const lines = configContent.split('\n');
      const stylingLine = lines.find(line => line.includes('styling'));
      if (stylingLine) {
        console.log('Styling line:', stylingLine.trim());
      }
    }

    // Build the project to test BEM
    console.log('\n🔨 Building project to test BEM...');
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    
    try {
      await execPromise(`cd ${targetDir} && pnpm install --silent`);
      await execPromise(`cd ${targetDir} && pnpm build`);
      console.log('✅ Build completed');

      // Check if BEM files were generated
      const distPath = `${targetDir}/dist`;
      if (await fs.pathExists(distPath)) {
        console.log('\n📁 Checking generated files...');
        const files = await fs.readdir(`${distPath}/react`);
        console.log('Generated files:', files);
        
        // Check for BEM classes in generated button file
        const buttonFile = `${distPath}/react/button.tsx`;
        if (await fs.pathExists(buttonFile)) {
          const content = await fs.readFile(buttonFile, 'utf-8');
          console.log('\n🎨 Button file contents:');
          console.log(content.substring(0, 500) + '...');
          console.log('\nContains BEM classes:', content.includes('button--primary'));
        }
      }
    } catch (buildError) {
      console.log('⚠️ Build error (expected if dependencies not published):', buildError.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBemInit();