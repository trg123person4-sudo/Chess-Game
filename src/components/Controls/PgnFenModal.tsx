import React, { useState } from 'react';
import { Copy, Check, Upload, X } from 'lucide-react';

interface PgnFenModalProps {
  currentFen: string;
  currentPgn: string;
  onImportFen: (fen: string) => boolean;
  onImportPgn: (pgn: string) => boolean;
  onClose: () => void;
}

export const PgnFenModal: React.FC<PgnFenModalProps> = ({
  currentFen,
  currentPgn,
  onImportFen,
  onImportPgn,
  onClose
}) => {
  const [tab, setTab] = useState<'fen' | 'pgn'>('fen');
  const [inputVal, setInputVal] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = () => {
    const text = tab === 'fen' ? currentFen : currentPgn;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = () => {
    setError(null);
    if (!inputVal.trim()) return;

    if (tab === 'fen') {
      const ok = onImportFen(inputVal.trim());
      if (ok) {
        onClose();
      } else {
        setError('Invalid FEN position string. Please check format.');
      }
    } else {
      const ok = onImportPgn(inputVal.trim());
      if (ok) {
        onClose();
      } else {
        setError('Invalid PGN string. Unable to parse moves.');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="pgnfen-tabs">
            <button
              onClick={() => {
                setTab('fen');
                setError(null);
              }}
              className={`pgnfen-tab-btn ${tab === 'fen' ? 'active' : ''}`}
            >
              FEN Position
            </button>
            <button
              onClick={() => {
                setTab('pgn');
                setError(null);
              }}
              className={`pgnfen-tab-btn ${tab === 'pgn' ? 'active' : ''}`}
            >
              PGN Game History
            </button>
          </div>
          <button onClick={onClose} className="close-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Value Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8' }}>
            <span>Current Game {tab.toUpperCase()}</span>
            <button
              onClick={handleCopy}
              className="btn-action"
              style={{ flex: 'initial', padding: '3px 8px', fontSize: '11px', color: '#f59e0b' }}
            >
              {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#34d399' }} /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={tab === 'fen' ? currentFen : currentPgn || 'No moves played yet.'}
            rows={tab === 'fen' ? 2 : 4}
            className="pgnfen-textarea"
          />
        </div>

        {/* Import Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #383530' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
            Load custom {tab.toUpperCase()}:
          </label>
          <textarea
            placeholder={
              tab === 'fen'
                ? 'Paste standard FEN (e.g. rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1)'
                : 'Paste standard PGN notation...'
            }
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            rows={3}
            className="pgnfen-textarea"
          />

          {error && <p style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>{error}</p>}

          <button
            onClick={handleImport}
            className="btn-action btn-primary"
            style={{ padding: '8px', marginTop: '4px' }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load {tab.toUpperCase()} into Game</span>
          </button>
        </div>
      </div>
    </div>
  );
};
