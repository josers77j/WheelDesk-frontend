export interface PdfPreviewFailure {
  code: 'resources' | 'password' | 'invalid' | 'load';
  message: string;
}

export function pdfPreviewFailure(error: unknown): PdfPreviewFailure {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (/worker|dynamically imported module/i.test(message)) {
    return {
      code: 'resources',
      message: 'No se pudo cargar el visor PDF. Recargue la página e intente nuevamente. En desarrollo, reinicie el servidor si acaba de instalar o actualizar el visor.',
    };
  }
  if (name === 'PasswordException') {
    return { code: 'password', message: 'Este PDF está protegido con contraseña. Utilice una copia sin contraseña para previsualizarlo.' };
  }
  if (name === 'InvalidPDFException') {
    return { code: 'invalid', message: 'El documento no es un PDF válido o está dañado. Revise el archivo seleccionado.' };
  }
  return { code: 'load', message: 'No se pudo obtener o mostrar el PDF. Compruebe la conexión y vuelva a intentarlo.' };
}
