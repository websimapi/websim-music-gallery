import { config } from './config.js';

const { useState, useEffect, useRef } = React;

const MusicGallery = () => {
    const [tracks, setTracks] = useState([]);
    const [isCreator, setIsCreator] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });
    const [playingTrack, setPlayingTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const room = useRef(new WebsimSocket()).current;
    
    useEffect(() => {
        // Check if current user is the creator
        const checkCreator = async () => {
            try {
                const creatorInfo = await window.websim.getCreatedBy();
                const currentUser = room.party.client.username;
                // Compare usernames directly and also check config for hardcoded admin
                setIsCreator(
                    creatorInfo.username === currentUser || 
                    config.adminUsers.includes(currentUser)
                );
                console.log("Creator check:", {
                    creator: creatorInfo.username,
                    currentUser,
                    isCreator: creatorInfo.username === currentUser || config.adminUsers.includes(currentUser)
                });
            } catch (error) {
                console.error("Error checking creator status:", error);
                // Fallback to config.adminUsers if there's an error
                setIsCreator(config.adminUsers.includes(room.party.client.username));
            }
        };
        
        checkCreator();
        
        // Subscribe to music tracks collection
        const unsubscribe = room.collection(config.collectionName).subscribe((musicTracks) => {
            // Sort by created_at in descending order
            const sortedTracks = [...musicTracks].sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            );
            setTracks(sortedTracks);
        });
        
        return () => unsubscribe();
    }, []);
    
    const handleUpload = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const title = formData.get('title');
        const artist = formData.get('artist');
        const file = formData.get('audioFile');
        
        if (!title || !artist || !file) {
            setUploadMessage({ type: 'error', text: 'Please fill all fields' });
            return;
        }
        
        if (!config.allowedFileTypes.includes(file.type)) {
            setUploadMessage({ 
                type: 'error', 
                text: `Invalid file type. Allowed types: ${config.allowedFileTypes.join(', ')}` 
            });
            return;
        }
        
        if (file.size > config.maxFileSizeMB * 1024 * 1024) {
            setUploadMessage({ 
                type: 'error', 
                text: `File too large. Maximum size: ${config.maxFileSizeMB}MB` 
            });
            return;
        }
        
        try {
            setIsUploading(true);
            setUploadMessage({ type: '', text: '' });
            
            // Upload file
            const fileUrl = await window.websim.upload(file);
            
            // Save track info to database
            await room.collection(config.collectionName).create({
                title,
                artist,
                fileUrl,
                fileType: file.type
            });
            
            setUploadMessage({ type: 'success', text: 'Track uploaded successfully!' });
            e.target.reset();
        } catch (error) {
            console.error("Error uploading file:", error);
            setUploadMessage({ type: 'error', text: 'Error uploading file. Please try again.' });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handlePlay = (track) => {
        setPlayingTrack(track);
        
        if (audioRef.current) {
            audioRef.current.src = track.fileUrl;
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(error => console.error("Error playing audio:", error));
        }
    };
    
    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play()
                    .catch(error => console.error("Error playing audio:", error));
            }
            setIsPlaying(!isPlaying);
        }
    };
    
    const handlePlayNext = () => {
        if (!playingTrack || tracks.length <= 1) return;
        
        const currentIndex = tracks.findIndex(track => track.id === playingTrack.id);
        const nextIndex = (currentIndex + 1) % tracks.length;
        handlePlay(tracks[nextIndex]);
    };
    
    const handlePlayPrevious = () => {
        if (!playingTrack || tracks.length <= 1) return;
        
        const currentIndex = tracks.findIndex(track => track.id === playingTrack.id);
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        handlePlay(tracks[prevIndex]);
    };
    
    const handleAudioEnded = () => {
        handlePlayNext();
    };
    
    return (
        <div className="container">
            <div className="header">
                <h1>{config.appName}</h1>
            </div>
            
            {isCreator && (
                <div className="upload-section">
                    <h2>Upload New Music</h2>
                    {uploadMessage.text && (
                        <div className={`message ${uploadMessage.type}`}>
                            {uploadMessage.text}
                        </div>
                    )}
                    <form onSubmit={handleUpload} className="upload-form">
                        <div className="form-group">
                            <label htmlFor="title">Track Title</label>
                            <input type="text" id="title" name="title" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="artist">Artist</label>
                            <input type="text" id="artist" name="artist" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="audioFile">Audio File (MP3, WAV, OGG)</label>
                            <input type="file" id="audioFile" name="audioFile" accept="audio/*" required />
                        </div>
                        <div className="form-group">
                            <button type="submit" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload Track'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {playingTrack && (
                <div className="now-playing">
                    <div className="now-playing-info">
                        <span className="now-playing-title">{playingTrack.title}</span>
                        <span>{playingTrack.artist}</span>
                    </div>
                    <div className="player-controls">
                        <button className="player-buttons" onClick={handlePlayPrevious}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                            </svg>
                        </button>
                        <button className="player-buttons" onClick={togglePlay}>
                            {isPlaying ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                            )}
                        </button>
                        <button className="player-buttons" onClick={handlePlayNext}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                            </svg>
                        </button>
                    </div>
                    <audio 
                        ref={audioRef} 
                        className="audio-player"
                        controls 
                        onEnded={handleAudioEnded}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                </div>
            )}
            
            <div className="music-gallery">
                {tracks.length === 0 ? (
                    <p>No music tracks available. {isCreator ? 'Upload some tracks to get started!' : 'Check back later!'}</p>
                ) : (
                    tracks.map(track => (
                        <div key={track.id} className="music-card">
                            <div className="music-info">
                                <h3 className="music-title">{track.title}</h3>
                                <p className="music-artist">{track.artist}</p>
                                <div className="music-uploader">Uploaded by: {track.username}</div>
                                <div className="music-controls">
                                    <button 
                                        className="play-button"
                                        onClick={() => handlePlay(track)}
                                    >
                                        {playingTrack && playingTrack.id === track.id && isPlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<MusicGallery />);