declare module 'qrcode-terminal' {
  interface QRCodeOptions {
    small?: boolean;
  }

  export function generate(text: string, options?: QRCodeOptions): void;
  export function setErrorLevel(level: string): void;
}