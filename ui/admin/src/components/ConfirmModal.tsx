'use client'

import { useState } from 'react'
import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (inputValue?: string) => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  showInput?: boolean
  inputLabel?: string
  inputPlaceholder?: string
  isLoading?: boolean
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  showInput = false,
  inputLabel,
  inputPlaceholder,
  isLoading = false,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('')

  const handleConfirm = () => {
    onConfirm(showInput ? inputValue : undefined)
    setInputValue('')
  }

  const handleClose = () => {
    setInputValue('')
    onClose()
  }

  const variantStyles = {
    danger: {
      icon: 'text-red-600 bg-red-100',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: 'text-yellow-600 bg-yellow-100',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    },
    info: {
      icon: 'text-blue-600 bg-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }

  const styles = variantStyles[variant]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${styles.button}`}
            disabled={isLoading || (showInput && !inputValue.trim())}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start space-x-4">
        <div className={`p-3 rounded-full ${styles.icon}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-gray-600">{message}</p>
          {showInput && (
            <div className="mt-4">
              {inputLabel && <label className="label">{inputLabel}</label>}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="input"
                placeholder={inputPlaceholder}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
