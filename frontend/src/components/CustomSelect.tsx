import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import styles from './CustomSelect.module.css'

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
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      <Listbox value={value} onChange={onChange}>
        <div className={styles.container}>
          <Listbox.Button className={styles.button}>
            <span className={styles.value}>{selectedOption?.label || placeholder}</span>
            <span className={styles.arrow}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </Listbox.Button>
          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <Listbox.Options className={styles.options}>
              {options.map((option) => (
                <Listbox.Option key={option.value} className={({ active, selected }) => `${styles.option} ${active ? styles.active : ''} ${selected ? styles.selected : ''}`} value={option.value}>
                  {({ selected }) => (
                    <>
                      <span className={styles.optionLabel}>{option.label}</span>
                      {selected && (
                        <span className={styles.optionCheck}>
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
    </div>
  )
}
