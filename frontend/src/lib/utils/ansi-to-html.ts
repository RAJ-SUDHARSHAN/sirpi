/**
 * Convert ANSI escape codes to HTML with inline styles
 * Supports colors, bold, and other common terminal formatting
 */

interface AnsiState {
  bold: boolean;
  foreground: string | null;
  background: string | null;
}

const ANSI_COLORS: Record<number, string> = {
  // Normal colors
  30: '#000000', // black
  31: '#cd3131', // red
  32: '#0dbc79', // green
  33: '#e5e510', // yellow
  34: '#2472c8', // blue
  35: '#bc3fbc', // magenta
  36: '#11a8cd', // cyan
  37: '#e5e5e5', // white
  // Bright colors
  90: '#666666', // bright black (gray)
  91: '#f14c4c', // bright red
  92: '#23d18b', // bright green
  93: '#f5f543', // bright yellow
  94: '#3b8eea', // bright blue
  95: '#d670d6', // bright magenta
  96: '#29b8db', // bright cyan
  97: '#ffffff', // bright white
};

const ANSI_BG_COLORS: Record<number, string> = {
  40: '#000000',
  41: '#cd3131',
  42: '#0dbc79',
  43: '#e5e510',
  44: '#2472c8',
  45: '#bc3fbc',
  46: '#11a8cd',
  47: '#e5e5e5',
  100: '#666666',
  101: '#f14c4c',
  102: '#23d18b',
  103: '#f5f543',
  104: '#3b8eea',
  105: '#d670d6',
  106: '#29b8db',
  107: '#ffffff',
};

export function ansiToHtml(text: string): string {
  const state: AnsiState = {
    bold: false,
    foreground: null,
    background: null,
  };

  let result = '';
  let currentSegment = '';
  let openSpan = false;

  // Match ANSI escape sequences: ESC [ <params> m
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add any text before this escape code
    currentSegment += text.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    // Parse the ANSI codes
    const codes = match[1].split(';').map(Number);
    
    for (const code of codes) {
      if (code === 0 || isNaN(code)) {
        // Reset all formatting
        if (openSpan) {
          result += escapeHtml(currentSegment) + '</span>';
          currentSegment = '';
          openSpan = false;
        }
        state.bold = false;
        state.foreground = null;
        state.background = null;
      } else if (code === 1) {
        // Bold
        state.bold = true;
      } else if (code === 22) {
        // Not bold
        state.bold = false;
      } else if (code >= 30 && code <= 37) {
        // Foreground color
        state.foreground = ANSI_COLORS[code];
      } else if (code >= 90 && code <= 97) {
        // Bright foreground color
        state.foreground = ANSI_COLORS[code];
      } else if (code >= 40 && code <= 47) {
        // Background color
        state.background = ANSI_BG_COLORS[code];
      } else if (code >= 100 && code <= 107) {
        // Bright background color
        state.background = ANSI_BG_COLORS[code];
      }
    }

    // Close previous span if open
    if (openSpan && currentSegment) {
      result += escapeHtml(currentSegment) + '</span>';
      currentSegment = '';
      openSpan = false;
    }

    // Open new span with current styles
    if (state.bold || state.foreground || state.background) {
      const styles: string[] = [];
      if (state.bold) styles.push('font-weight: bold');
      if (state.foreground) styles.push(`color: ${state.foreground}`);
      if (state.background) styles.push(`background-color: ${state.background}`);
      
      result += `<span style="${styles.join('; ')}">`;
      openSpan = true;
    }
  }

  // Add remaining text
  currentSegment += text.slice(lastIndex);
  
  if (openSpan) {
    result += escapeHtml(currentSegment) + '</span>';
  } else {
    result += escapeHtml(currentSegment);
  }

  return result;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
