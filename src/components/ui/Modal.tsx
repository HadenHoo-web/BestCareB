import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={event => event.stopPropagation()}><header><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Đóng" onClick={onClose}><X size={18}/></button></header>{children}</section></div>;
}
