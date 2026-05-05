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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="ff-panel max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-primary/10 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Keyboard className="text-primary" size={20} />
                        <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="rounded-md p-2 text-secondary transition-colors hover:bg-white/5 hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] space-y-6 overflow-y-auto p-6">
                    {shortcuts.map((section) => (
                        <div key={section.category}>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                                {section.category}
                            </h3>
                            <div className="space-y-2">
                                {section.items.map((shortcut, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-1.5">
                                        <span className="text-sm text-foreground">{shortcut.description}</span>
                                        <div className="flex items-center gap-1">
                                            {shortcut.keys.map((key, keyIdx) => (
                                                <React.Fragment key={keyIdx}>
                                                    {keyIdx > 0 && <span className="text-xs text-secondary/60">+</span>}
                                                    <kbd className="rounded border border-primary/10 bg-[#050608] px-2 py-1 font-mono text-xs text-secondary">
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
                <div className="border-t border-primary/10 bg-[#050608]/70 px-6 py-3">
                    <p className="text-center text-xs text-secondary/70">
                        Press <kbd className="rounded border border-primary/10 bg-[#050608] px-1.5 py-0.5 font-mono text-xs text-secondary">Esc</kbd> or <kbd className="rounded border border-primary/10 bg-[#050608] px-1.5 py-0.5 font-mono text-xs text-secondary">?</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    )
}
