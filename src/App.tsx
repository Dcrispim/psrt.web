import { Header } from './components/editor/Header';
import { PageThumbnailsSidebar } from './components/PageThumbnailsSidebar';
import { Canvas } from './components/Canvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Toast } from './components/Toast';
import { ConnectorBanner } from './components/ConnectorBanner';

export function App() {
  return (
    <>
      <ConnectorBanner />
      <Header />
      <main className="workspace">
        <PageThumbnailsSidebar />
        <Canvas />
        <PropertiesPanel />
      </main>
      <Toast />
    </>
  );
}
