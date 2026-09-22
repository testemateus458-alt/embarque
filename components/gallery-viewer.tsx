"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Camera, X } from "lucide-react";

export type GalleryPhoto = { id: string; url: string; created_at: string };

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const scope = ref.current;
    scope?.querySelector<HTMLButtonElement>("button")?.focus();

    const handle = (event: KeyboardEvent) => {
      if (!scope) return;
      if (document.querySelector(".image-lightbox") && !scope.classList.contains("image-lightbox")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      }
      if (event.key === "Tab") {
        const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handle, true);
    return () => {
      document.removeEventListener("keydown", handle, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref]);
}

function EnlargedPhoto({ photos, number, selected, onSelect, onClose }: {
  photos: GalleryPhoto[];
  number: string;
  selected: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const index = Math.min(selected, photos.length - 1);
  const current = photos[index];
  useDialogFocus(dialog, onClose);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (photos.length < 2) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        onSelect((index + (event.key === "ArrowRight" ? 1 : photos.length - 1)) % photos.length);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [index, photos.length, onSelect]);

  if (!current) return null;

  return createPortal(<div className="original-polish">
    <div ref={dialog} className="image-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${index + 1} de ${photos.length}, lote ${number}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lightbox-heading"><Camera size={17}/><span>Lote {number}</span></div>
      <button className="image-close" type="button" onClick={onClose} aria-label="Fechar foto ampliada"><X size={20}/></button>
      <img key={current.id} src={current.url} alt={`Foto ${index + 1} da carga do lote ${number}`}/>
      <div className="lightbox-controls">
        <button type="button" disabled={photos.length < 2} aria-label="Foto anterior" onClick={() => onSelect((index + photos.length - 1) % photos.length)}><ArrowLeft size={19}/></button>
        <span aria-live="polite">{index + 1} / {photos.length}</span>
        <button type="button" disabled={photos.length < 2} aria-label="Próxima foto" onClick={() => onSelect((index + 1) % photos.length)}><ArrowRight size={19}/></button>
      </div>
      {dateLabel(current.created_at) && <p>{dateLabel(current.created_at)}</p>}
    </div>
  </div>, document.body);
}

export function PhotoGallery({ photos, number }: { photos: GalleryPhoto[]; number: string }) {
  const [selected, setSelected] = useState<number | null>(null);

  return <>
    <div className="gallery-grid">{photos.map((photo, index) => <button type="button" className="gallery-photo" key={photo.id} onClick={() => setSelected(index)} aria-label={`Ampliar foto ${index + 1} do lote ${number}`}>
      <img src={photo.url} alt={`Foto ${index + 1} da carga do lote ${number}`} loading="lazy"/>
      <small>{dateLabel(photo.created_at) || `Foto ${index + 1} da carga`}</small>
    </button>)}</div>
    {selected !== null && photos.length > 0 && <EnlargedPhoto photos={photos} number={number} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)}/>}
  </>;
}

export function PhotoViewer({ load, photos, onClose }: {
  load: { number: string };
  photos: GalleryPhoto[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, onClose);

  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label={`Fotos da carga, lote ${load.number}`} className="modal photo-viewer">
      <div className="modal-title"><div><small>FOTOS DA CARGA</small><h2>Lote {load.number}</h2></div><button type="button" aria-label="Fechar galeria" onClick={onClose}><X size={20}/></button></div>
      {photos.length > 0 && <p className="gallery-summary">{photos.length} {photos.length === 1 ? "foto registrada" : "fotos registradas"} · Selecione uma imagem para ampliar.</p>}
      <div className="photo-gallery">{photos.length > 0 ? <PhotoGallery photos={photos} number={load.number}/> : <div className="gallery-empty"><Camera size={32}/><h3>Nenhuma foto cadastrada</h3><p>Adicione fotos pela edição do lote para acompanhar os detalhes da carga.</p></div>}</div>
    </section>
  </div>;
}
