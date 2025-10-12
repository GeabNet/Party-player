import React from 'react'

export default function IconButton({ icon, onClick, label = '', className = '', title = '' }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-3 py-2 rounded-md focus-ring btn-transition ${className}`}
      title={title || label}
      aria-label={label}
    >
      <i className={`${icon} text-lg`} aria-hidden />
      {label && <span className="text-sm">{label}</span>}
    </button>
  )
}
