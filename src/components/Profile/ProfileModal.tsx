import React, { useState } from 'react';
import {
  getCurrentUser,
  saveCurrentUser,
  getArchivedGames,
  UserProfile,
  ArchivedGame
} from '../../services/ratings';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  const [archive, setArchive] = useState<ArchivedGame[]>(getArchivedGames());
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.username);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSaveName = () => {
    const clean = nameInput.trim() || 'Player';
    const updated = { ...user, username: clean };
    saveCurrentUser(updated);
    setUser(updated);
    setEditingName(false);
  };

  const handleCopyPgn = (game: ArchivedGame) => {
    navigator.clipboard.writeText(game.pgn);
    setCopiedId(game.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadPgn = (game: ArchivedGame) => {
    const blob = new Blob([game.pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chess_game_${game.id}.pgn`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const winRate = user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 100) : 0;

  return (
    <div className="promotion-modal-overlay" onClick={onClose}>
      <div
        className="profile-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ground)',
          border: '1px solid var(--graphite-dim)',
          width: '520px',
          maxWidth: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          gap: '20px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--graphite-dim)',
                    color: 'var(--ink)',
                    padding: '4px 8px',
                    fontSize: '14px',
                    borderRadius: '2px'
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  style={{ color: 'var(--accent)', fontSize: '12px' }}
                >
                  Save
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
                  {user.username}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  style={{ color: 'var(--graphite)', fontSize: '11px' }}
                >
                  Rename
                </button>
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--graphite)' }}>
              Rating: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{user.rating}</span> (Peak: {user.peakRating})
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--graphite)', fontSize: '13px' }}
          >
            Close
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            border: '1px solid var(--graphite-dim)',
            padding: '12px',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--graphite)' }}>Games</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{user.gamesPlayed}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--graphite)' }}>Wins</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{user.wins}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--graphite)' }}>Losses</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink)' }}>{user.losses}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--graphite)' }}>Win Rate</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent)' }}>{winRate}%</div>
          </div>
        </div>

        {/* Game History List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--graphite)' }}>
            Recent Rated Games ({archive.length})
          </div>

          {archive.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--graphite)', padding: '16px 0', fontStyle: 'italic' }}>
              No games completed yet. Play a rated match to view archive.
            </div>
          ) : (
            archive.map((g) => (
              <div
                key={g.id}
                style={{
                  border: '1px solid var(--graphite-dim)',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--ink)' }}>
                    {g.whitePlayer} vs {g.blackPlayer}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--graphite)' }}>
                    {g.date} • {g.result} • {g.reason} ({g.movesCount} moves)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyPgn(g)}
                    style={{
                      fontSize: '11px',
                      color: copiedId === g.id ? 'var(--accent)' : 'var(--graphite)'
                    }}
                  >
                    {copiedId === g.id ? 'Copied' : 'PGN'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPgn(g)}
                    style={{ fontSize: '11px', color: 'var(--graphite)' }}
                  >
                    Export
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
