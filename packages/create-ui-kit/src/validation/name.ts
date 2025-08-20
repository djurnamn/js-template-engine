export function validateProjectName(name: string): true | string {
  if (!name) {
    return 'Project name is required';
  }

  if (name.length < 2) {
    return 'Project name must be at least 2 characters';
  }

  if (name.length > 214) {
    return 'Project name must be less than 214 characters';
  }

  if (name.toLowerCase() !== name) {
    return 'Project name must be lowercase';
  }

  if (!/^[a-z0-9-_]+$/.test(name)) {
    return 'Project name can only contain lowercase letters, numbers, hyphens, and underscores';
  }

  if (name.startsWith('-') || name.startsWith('_')) {
    return 'Project name cannot start with a hyphen or underscore';
  }

  if (name.endsWith('-') || name.endsWith('_')) {
    return 'Project name cannot end with a hyphen or underscore';
  }

  // Reserved names
  const reservedNames = [
    'node_modules', '.git', '.gitignore', '.npmignore', 
    'package.json', 'readme', 'license', 'changelog'
  ];
  
  if (reservedNames.includes(name.toLowerCase())) {
    return `"${name}" is a reserved name and cannot be used`;
  }

  return true;
}