/**
 * Toast Notification Component
 * 
 * Simple toast for showing temporary feedback messages.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { Undo2, Redo2, Copy, ClipboardPaste, Scissors, Trash2, Check } from 'lucide-react'

export type ToastType = 'undo' | 'redo' | 'copy' | 'paste' | 'split' | 'delete' | 'success'

interface ToastProps {
    message: string
    type: ToastType
    visible: boolean
    onHide: () => void
}

const iconMap: Record<ToastType, React.ReactNode> = {
    undo: <Undo2 size={16} />,
    redo: <Redo2 size={16} />,
    copy: <Copy size={16} />,
    paste: <ClipboardPaste size={16} />,
    split: <Scissors size={16} />,
    delete: <Trash2 size={16} />,
    success: <Check size={16} />,
}

export const Toast: React.FC<ToastProps> = ({ message, type, visible, onHide }) => {
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => {
                onHide()
            }, 1500)
            return () => clearTimeout(timer)
        }
    }, [visible, onHide])

    if (!visible) return null

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-[#0c1118]/95 px-4 py-2 text-sm text-foreground shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                <span className="text-primary">{iconMap[type]}</span>
                <span>{message}</span>
            </div>
        </div>
    )
}

// Toast hook for easy usage
export const useToast = () => {
    const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
        message: '',
        type: 'success',
        visible: false,
    })

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type, visible: true })
    }

    const hideToast = () => {
        setToast((prev) => ({ ...prev, visible: false }))
    }

    return { toast, showToast, hideToast }
}
