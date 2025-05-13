import { ReactExtension } from '@js-template-engine/extension-react';
import { BemExtension } from '@js-template-engine/extension-bem';

export default {
  input: './src',
  output: './output/react',
  extensions: [
    new BemExtension(true),
    new ReactExtension(true),
  ],
  globalOptions: {
    fileExtension: '.tsx',
    writeOutputFile: true,
    verbose: true,
    componentName: 'Button',
    importStatements: [
      "import React from 'react';"
    ],
    propsInterface: `
interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
}
    `,
    props: 'props'
  }
}; 