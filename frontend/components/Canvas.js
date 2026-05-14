import { useState, useRef, useEffect, useCallback } from 'react';

const Canvas = ({ socket, roomCode, isHost, username }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Colors for the palette
  const colors = [
    '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
    '#ff00ff', '#00ffff', '#ffa500', '#800080', '#ffc0cb'
  ];

  // Brush sizes
  const brushSizes = [2, 5, 10, 15, 20];

  const getMousePos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    // Scale coordinates to match canvas internal size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const drawLine = (startX, startY, endX, endY, drawColor, drawBrushSize) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('Canvas not ready for drawing');
      return;
    }
    
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('Canvas not ready for clearing');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Set canvas background to dark
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Set up socket listeners after component mounts
  useEffect(() => {
    if (!socket) return;

    const handleCanvasDraw = (data) => {
      drawLine(data.startX, data.startY, data.endX, data.endY, data.color, data.brushSize);
    };

    const handleCanvasClear = () => {
      clearCanvas();
    };

    const handleJoinedRoom = (data) => {
      // Replay canvas history
      if (data.canvasHistory && data.canvasHistory.length > 0) {
        // Clear canvas first
        clearCanvas();
        
        // Replay all drawings
        data.canvasHistory.forEach(drawing => {
          drawLine(drawing.startX, drawing.startY, drawing.endX, drawing.endY, drawing.color, drawing.brushSize);
        });
      }
    };

    socket.on('canvas-draw', handleCanvasDraw);
    socket.on('canvas-clear', handleCanvasClear);
    socket.on('joined-room', handleJoinedRoom);

    return () => {
      socket.off('canvas-draw', handleCanvasDraw);
      socket.off('canvas-clear', handleCanvasClear);
      socket.off('joined-room', handleJoinedRoom);
    };
  }, [socket]);

  const startDrawing = (e) => {
    if (!isHost) return;

    const pos = getMousePos(e);
    setIsDrawing(true);
    setLastPos(pos);
  };

  const draw = (e) => {
    if (!isDrawing || !isHost) return;

    const pos = getMousePos(e);
    drawLine(lastPos.x, lastPos.y, pos.x, pos.y, color, brushSize);

    // Send drawing data to other users
    socket.emit('canvas-draw', {
      roomCode,
      startX: lastPos.x,
      startY: lastPos.y,
      endX: pos.x,
      endY: pos.y,
      color,
      brushSize
    });

    setLastPos(pos);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    if (!isHost) return;

    clearCanvas();
    socket.emit('canvas-clear', { roomCode });
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 shadow-lg">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Collaborative Canvas</h3>
            <p className="text-gray-300 text-sm">
              {isHost ? 'You control the canvas' : `${username} is drawing`}
            </p>
          </div>
        </div>

        {isHost && (
          <button
            onClick={handleClear}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-colors"
          >
            Clear Canvas
          </button>
        )}
      </div>

      {/* Drawing Tools */}
      {isHost && (
        <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-medium text-sm">Drawing Tools</span>
          </div>

          {/* Color Palette */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-gray-300 text-xs mr-2">Color:</span>
            <div className="flex space-x-1">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-gray-500 hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Brush Size */}
          <div className="flex items-center space-x-2">
            <span className="text-gray-300 text-xs mr-2">Size:</span>
            <div className="flex space-x-1">
              {brushSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`w-8 h-8 rounded border-2 flex items-center justify-center text-xs font-medium transition-all ${
                    brushSize === size
                      ? 'border-white bg-blue-600 text-white scale-110'
                      : 'border-gray-500 hover:border-gray-300 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className={`border-2 rounded-lg ${
            isHost
              ? 'cursor-crosshair border-blue-400'
              : 'cursor-not-allowed border-gray-600'
          }`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            backgroundColor: '#1a1a1a',
            touchAction: 'none' // Prevent scrolling on touch
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {!isHost && (
          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">👀</div>
              <div className="text-white font-medium">Viewing Mode</div>
              <div className="text-gray-300 text-sm">Only the host can draw</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;