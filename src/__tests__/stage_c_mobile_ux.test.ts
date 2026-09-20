import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('STAGE C: FINAL MOBILE UX QA VALIDATION', () => {
  it('prevents iOS Safari auto-zoom on mobile inputs in index.css', () => {
    const cssPath = path.resolve(process.cwd(), 'src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');
    expect(cssContent).toContain('font-size: 16px !important;');
    expect(cssContent).toContain('overflow-x: hidden;');
    expect(cssContent).toContain('max-width: 100vw;');
  });

  it('uses dynamic viewport units and safe-area bottom padding in App.tsx', () => {
    const appPath = path.resolve(process.cwd(), 'src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    expect(appContent).toContain('min-h-[100dvh]');
    expect(appContent).toContain('pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]');
  });

  it('ensures modals lock background body scroll to prevent layout jumps', () => {
    const createModalPath = path.resolve(process.cwd(), 'src/components/CreateServiceRequestModal.tsx');
    const detailModalPath = path.resolve(process.cwd(), 'src/components/ServiceRequestDetailModal.tsx');
    const contactModalPath = path.resolve(process.cwd(), 'src/components/ContactRequestModal.tsx');
    const artisanModalPath = path.resolve(process.cwd(), 'src/components/ArtisanDetailModal.tsx');

    const createContent = fs.readFileSync(createModalPath, 'utf-8');
    const detailContent = fs.readFileSync(detailModalPath, 'utf-8');
    const contactContent = fs.readFileSync(contactModalPath, 'utf-8');
    const artisanContent = fs.readFileSync(artisanModalPath, 'utf-8');

    expect(createContent).toContain("document.body.style.overflow = 'hidden'");
    expect(detailContent).toContain("document.body.style.overflow = 'hidden'");
    expect(contactContent).toContain("document.body.style.overflow = 'hidden'");
    expect(artisanContent).toContain("document.body.style.overflow = 'hidden'");
  });

  it('ensures BottomNav handles safe-area-inset-bottom and minimum touch heights', () => {
    const navPath = path.resolve(process.cwd(), 'src/components/BottomNav.tsx');
    const navContent = fs.readFileSync(navPath, 'utf-8');
    expect(navContent).toContain('env(safe-area-inset-bottom,0px)');
    expect(navContent).toContain('min-h-[48px]');
  });

  it('ensures ToastNotification respects safe-area-inset-bottom without blocking clicks', () => {
    const toastPath = path.resolve(process.cwd(), 'src/components/ToastNotification.tsx');
    const toastContent = fs.readFileSync(toastPath, 'utf-8');
    expect(toastContent).toContain('env(safe-area-inset-bottom,0px)');
    expect(toastContent).toContain('pointer-events-none');
    expect(toastContent).toContain('pointer-events-auto');
  });

  it('ensures ArtisanCard has proper touch target dimensions and whitespace formatting', () => {
    const cardPath = path.resolve(process.cwd(), 'src/components/ArtisanCard.tsx');
    const cardContent = fs.readFileSync(cardPath, 'utf-8');
    expect(cardContent).toContain('w-10 h-10');
    expect(cardContent).toContain('whitespace-nowrap');
  });

  it('confirms no lingering unconstrained 100vh classes in src/ components that break mobile viewports', () => {
    const componentsDir = path.resolve(process.cwd(), 'src/components');
    const files = fs.readdirSync(componentsDir);
    for (const file of files) {
      if (file.endsWith('.tsx')) {
        const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
        expect(content).not.toContain('100vh');
      }
    }
  });
});
