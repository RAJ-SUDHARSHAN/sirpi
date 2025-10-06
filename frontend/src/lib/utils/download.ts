/**
 * Utility function to download files as ZIP
 */

import JSZip from 'jszip';

export interface FileToZip {
  filename: string;
  content: string;
}

export async function downloadFilesAsZip(
  files: FileToZip[],
  zipFilename: string = 'infrastructure-files.zip'
): Promise<void> {
  const zip = new JSZip();

  files.forEach(file => {
    zip.file(file.filename, file.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
