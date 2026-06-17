import { useEffect, useState } from "react";
import s from "./AssetGallery.module.css";
import {
  getLocalImage,
  getLocalImageDataUri,
  listLocalImages,
  deleteLocalAssetRef,
  type LocalImageValue,
} from "../services/localImageStore";
import { navigateTo } from "../lib/hashRoute";
import { logger } from "../api/logger";

interface LocalAsset {
  id: string;
  blobUrl: string;
  type: string;
  size: number;
}

function getLocalAssetMeta(record: LocalImageValue | null): { type: string; size: number } {
  if (!record) return { type: "", size: 0 };
  if (typeof record === "string") {
    const type = record.startsWith("data:")
      ? (record.match(/^data:([^;,]+)/)?.[1] ?? "image/png")
      : "image/png";
    return { type, size: new Blob([record]).size };
  }
  return { type: record.type || "", size: record.size };
}

export function AssetGallery() {
  const [assets, setAssets] = useState<LocalAsset[]>([]);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    const items = await listLocalImages();
    const loaded = await Promise.all(
      items.map(async (item) => {
        const record = await getLocalImage(item);
        const { type, size } = getLocalAssetMeta(record);
        return {
          id: item,
          blobUrl: await getLocalImageDataUri(item),
          type,
          size,
        };
      })
    );
    setAssets(loaded);
  };

  const copyToClipboard = (id: string) => {
    const ref = `@local:${id}`;
    navigator.clipboard.writeText(ref);
  };

  const deleteAsset = (id: string) => {
    deleteLocalAssetRef(id).then(() => {
      loadAssets();
    }).catch((error) => {
      logger('AssetGallery.deleteAsset', {
        error: error,
      });
      console.error(`Error deleting asset ${id}`, error);
    });
  };

  return (
    <div className={s.container}>
      <div className={s.header}>
        <div>
          <button type="button" className={s.btn} onClick={() => navigateTo('editor')}>
            Editor
          </button>
          <h2>Galeria de Assets Locais</h2>
        </div>
      </div>

      <div className={s.grid}>
        {assets.map((asset) => (
          <div key={asset.id} className={s.card}>
            <div className={s.preview}>
              {asset.type.startsWith("image") ? (
                <img src={asset.blobUrl} alt={asset.id} />
              ) : (
                <span className={s.fontPreview}>Aa</span>
              )}
            </div>

            <div className={s.info}>
              <span className={s.id}>ID: {asset.id}</span>
              <span className={s.size}>
                {(asset.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>

            <div className={s.actions}>
              <button
                className={s.btn}
                onClick={() => copyToClipboard(asset.id)}
                title="Copiar referência @local"
              >
                Copiar Ref
              </button>
              <button
                className={`${s.btn} ${s.btnDanger}`}
                onClick={() => deleteAsset(asset.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}

        {assets.length === 0 && (
          <div className={s.empty}>Nenhum asset local encontrado.</div>
        )}
      </div>
    </div>
  );
}
