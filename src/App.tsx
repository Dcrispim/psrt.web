import { Header } from './components/editor/Header';
import { PageThumbnailsSidebar } from './components/PageThumbnailsSidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Toast } from './components/Toast';
import { HtmlExportOverlay } from './components/HtmlExportOverlay';
import { ConnectorBanner } from './components/ConnectorBanner';
import { OfflineBanner } from './components/OfflineBanner';

export function App() {
  return (
    <>
      <OfflineBanner />
      <ConnectorBanner />
      <Header />
      <main className="workspace">
        <PageThumbnailsSidebar />
        <Canvas />
        <PropertiesPanel />
      </main>
      <Toast />
      <HtmlExportOverlay />
    </>
  );
}
