import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'

interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
}

export default function CustomSelect({ value, onChange, options, placeholder = '请选择', label }: CustomSelectProps) {
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="custom-select-wrapper">
      {label && <label className="custom-select-label">{label}</label>}
      <Listbox value={value} onChange={onChange}>
        <div className="custom-select-container">
          <Listbox.Button className="custom-select-button">
            <span className="custom-select-value">{selectedOption?.label || placeholder}</span>
            <span className="custom-select-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </Listbox.Button>
          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Listbox.Options className="custom-select-options">
              {options.map((option) => (
                <Listbox.Option key={option.value} className={({ active, selected }) => `custom-select-option ${active ? 'active' : ''} ${selected ? 'selected' : ''}`} value={option.value}>
                  {({ selected }) => (
                    <>
                      <span className="custom-select-option-label">{option.label}</span>
                      {selected && (
                        <span className="custom-select-option-check">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      <style>{`
        .custom-select-wrapper { margin-bottom: 16px; }
        .custom-select-label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 8px; color: #111; }
        .custom-select-container { position: relative; }
        .custom-select-button { width: 100%; padding: 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 15px; background: #f7f7f8; cursor: pointer; min-height: 48px; display: flex; align-items: center; justify-content: space-between; text-align: left; transition: all 0.2s; box-sizing: border-box; color: #111; }
        .custom-select-button:hover { border-color: #ccc; }
        .custom-select-button:focus { outline: none; border-color: #999; }
        .custom-select-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #111; }
        .custom-select-arrow { color: #666; margin-left: 8px; flex-shrink: 0; }
        .custom-select-options { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; max-height: 250px; overflow: auto; z-index: 50; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .custom-select-option { padding: 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.15s; color: #111; }
        .custom-select-option:hover, .custom-select-option.active { background: #f7f7f8; }
        .custom-select-option.selected { background: #f0f0f0; color: #111; font-weight: 500; }
        .custom-select-option-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .custom-select-option-check { flex-shrink: 0; margin-left: 8px; }
        @media (max-width: 768px) { .custom-select-button { font-size: 16px; min-height: 44px; padding: 10px 12px; } .custom-select-options { max-height: 200px; } .custom-select-option { padding: 14px 12px; font-size: 16px; } }
      `}</style>
    </div>
  )
}
