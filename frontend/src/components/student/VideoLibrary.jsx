import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VideoLibrary = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    axios.get('/api/videos/my').then(r => setVideos(r.data)).catch(() => {});
  }, []);

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-4">My Video Library ({videos.length})</h2>
      {videos.length === 0 && <p className="text-gray-500 text-sm">No videos assigned yet.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {videos.map(v => (
          <div key={v.id} style={{ border: '1px solid var(--gray-200)', borderRadius: '0.75rem', padding: '1rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{v.title || 'Untitled Video'}</p>
            {v.duration && <p className="text-sm text-gray-500" style={{ marginBottom: '0.5rem' }}>Duration: {Math.floor(v.duration / 60)}m {v.duration % 60}s</p>}
            <a href={v.video_url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', padding: '4px 14px', background: 'var(--primary)', color: '#fff', borderRadius: '6px', fontSize: '0.85rem', textDecoration: 'none' }}>
              ▶ Watch
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoLibrary;
