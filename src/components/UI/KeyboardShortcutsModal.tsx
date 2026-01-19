/**
 * Keyboard Shortcuts Modal
 * 
 * Shows all available keyboard shortcuts when ? is pressed.
 */

'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { X, Keyboard } from 'lucide-react'

const shortcuts = [
    {
        category: 'Playback', items: [
            { keys: ['Space'], description: 'Play / Pause' },
            { keys: ['←'], description: 'Previous frame' },
            { keys: ['→'], description: 'Next frame' },
            { keys: ['Shift', '←'], description: 'Back 1 second' },
            { keys: ['Shift', '→'], description: 'Forward 1 second' },
            { keys: ['Home'], description: 'Jump to start' },
            { keys: ['End'], description: 'Jump to end' },
        ]
    },
    {
        category: 'Editing', items: [
            { keys: ['S'], description: 'Split clip at playhead' },
            { keys: ['Delete'], description: 'Delete selected clip' },
            { keys: ['Cmd', 'C'], description: 'Copy clip' },
            { keys: ['Cmd', 'X'], description: 'Cut clip' },
            { keys: ['Cmd', 'V'], description: 'Paste clip' },
        ]
    },
    {
        category: 'History', items: [
            { keys: ['Cmd', 'Z'], description: 'Undo' },
            { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
            { keys: ['Cmd', 'S'], description: 'Save' },
        ]
    },
    {
        category: 'View', items: [
            { keys: ['?'], description: 'Show shortcuts' },
            { keys: ['Esc'], description: 'Close modal / Deselect' },
        ]
    },
]

export const KeyboardShortcutsModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false)

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in input
        if ((e.target as HTMLElement).tagName === 'INPUT' ||
            (e.target as HTMLElement).tagName === 'TEXTAREA') return

        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault()
            setIsOpen(true)
        }

        if (e.key === 'Escape' && isOpen) {
            e.preventDefault()
            setIsOpen(false)
        }
    }, [isOpen])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <Keyboard className="text-primary" size={20} />
                        <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {shortcuts.map((section) => (
                        <div key={section.category}>
                            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map((shortcut, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-1.5">
                                        <span className="text-sm text-slate-300">{shortcut.description}</span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    {keyIdx > 0 && <span className="text-slate-500 text-xs">+</span>}
                                                    <kbd className="px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-slate-200">
                                                        {key}
                                                    </kbd>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-700 bg-slate-800/50">
                    <p className="text-xs text-slate-500 text-center">
                        Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-700 border border-slate-600 rounded">Esc</kbd> or <kbd className="px-1.5 py-0.5 text-xs font-mono bg-slate-700 border border-slate-600 rounded">?</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    )
}
