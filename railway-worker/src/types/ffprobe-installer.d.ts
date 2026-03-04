declare module '@ffprobe-installer/ffprobe' {
  export interface FFprobeInstaller {
    path: string;
    version: string;
  }

  const ffprobeInstaller: FFprobeInstaller;
  export default ffprobeInstaller;
}
