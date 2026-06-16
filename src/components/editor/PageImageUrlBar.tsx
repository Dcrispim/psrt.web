import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@wails/go/main/GUIApp';
import { buildPageImageRefFromLocalPath } from '../../lib/localAssetRef';
import s from './sidebar.module.css';
import alertS from './alertModal.module.css';
import { AlertModal, type PromptInputProps } from './AlertModal';
import { localKeyFromRef, renameLocalAssetRef } from '../../services/localImageStore';
import { applyConstantsToReference, resolveAssetReference } from '../../lib/expandConsts';
import { formatConstUsageToken } from '../../lib/psrtConstPreview';
import { IconEdit, IconStrike } from './icons';

interface PageImageUrlBarProps {
  imageUrl: string;
  consts?: Record<string, string>;
  onChange: (url: string) => void;
  onRefresh?: () => void;
  onError?: (message: string) => void;
}

export function PageImageUrlBar({
  imageUrl,
  consts,
  onChange,
  onRefresh,
  onError,
}: PageImageUrlBarProps) {

  const [value, setValue] = useState(imageUrl);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  useEffect(() => {
    setValue(imageUrl);
  }, [imageUrl]);

  const onPickLocalImage = useCallback(async () => {
    setPicking(true);
    try {
      const fsPath = await api.OpenImageFileDialog();
      if (!fsPath) return;
      if (fsPath.startsWith('@local:')) {
        setValue(fsPath);
        onChange(fsPath);
        setRenameName(localKeyFromRef(fsPath) ?? fsPath);
        setRenameModalOpen(true);
        onRefresh?.();
        return;
      }
      const ref = fsPath.startsWith('data:')
        ? fsPath
        : buildPageImageRefFromLocalPath(fsPath, consts);
      setValue(ref);
      onChange(ref);
      onRefresh?.();
    } catch (e) {
      onError?.(String(e));
    } finally {
      setPicking(false);
    }
  }, [consts, onChange, onRefresh, onError]);

  return (
    <div className={s.pageImageBar}>
      <label className={s.label} htmlFor="page-image-url-editor">
        Imagem da página
      </label>
      <div className={s.pageImageRow}>
        <input
          id="page-image-url-editor"
          type="text"
          className={s.input}
          value={editing ? value : applyConstantsToReference(value, consts)}
          spellCheck={false}
          placeholder="URL da imagem…"
          disabled={!editing}
          onBlur={() => setEditing(false)}
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            onChange(next);
          }}
        />
        {
          !editing && (
            <button
              type="button"
              className={s.pageImageActionBtn}
              title="Salvar imagem"
              onClick={() => setEditing(true)}
            >
              <IconEdit />
            </button>
          )

        }
        {
          editing && (
            <button
              type="button"
              className={s.pageImageActionBtn}
              title="Salvar imagem"
              onClick={() => setEditing(false)}
            >
              <IconStrike />
            </button>
          )
        }
        <button
          type="button"
          className={s.pageImageActionBtn}
          title="Usar imagem local"
          disabled={picking}
          onClick={() => {
            onPickLocalImage().catch((e) => onError?.(String(e)));
          }}
        >
          📁
        </button>
        {onRefresh ? (
          <button
            type="button"
            className={s.pageImageActionBtn}
            title="Atualizar imagem do cache"
            onClick={onRefresh}
          >
            ↻
          </button>
        ) : null}
      </div>
      <RenameModal
        key={renameName}
        open={renameModalOpen}
        defaultValue={renameName}
        consts={consts}
        onConfirm={async (name) => {
          try {
            const newRef = await renameLocalAssetRef(value, resolveAssetReference(name, consts));
            setValue(newRef);
            onChange(newRef);
            onRefresh?.();
            setRenameModalOpen(false);
          } catch (e) {
            onError?.(String(e));
          }
        }}
        onCancel={() => setRenameModalOpen(false)}
      />
    </div>
  );
}

const RenameModal = ({
  open,
  defaultValue,
  consts,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  defaultValue: string;
  consts?: Record<string, string>;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) => {
  return (
    <AlertModal
      open={open}
      mode="prompt"
      title="Renomear imagem"
      message="Deseja renomear a imagem?"
      confirmLabel="Renomear"
      cancelLabel="Cancelar"
      defaultValue={defaultValue}
      placeholder="Nome do arquivo…"
      onConfirm={(name) => onConfirm(name ?? '')}
      onCancel={() => onCancel()}
      InputComponent={(props) => <ConstantInput {...props} consts={consts} />}
    />
  );
};

const ConstantInput = ({
  ref: inputRef,
  defaultValue,
  placeholder,
  consts,
}: PromptInputProps & { consts?: Record<string, string> }) => {
  const [text, setText] = useState(defaultValue);
  const localRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(defaultValue);
  }, [defaultValue]);

  const setRefs = (el: HTMLInputElement | null) => {
    localRef.current = el;
    inputRef.current = el;
  };

  const insertToken = (name: string) => {
    const token = formatConstUsageToken(name);
    const el = localRef.current;
    if (!el) {
      setText((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const entries = Object.entries(consts ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <input
        ref={setRefs}
        type="text"
        className={alertS.input}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
      />
      {entries.length > 0 ? (
        <ul className={alertS.constPool}>
          {entries.map(([name, value]) => (
            <li key={name}>
              <button
                type="button"
                className={alertS.constChip}
                title={value}
                onClick={() => insertToken(name)}
              >
                {formatConstUsageToken(name)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};