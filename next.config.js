/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf2json не бандлимо — лишаємо як зовнішній серверний пакет
  experimental: {
    serverComponentsExternalPackages: ['pdf2json'],
  },
};

module.exports = nextConfig;
