export type PositionProps = 'top-right' | 'right-center' | 'bottom-right' | 'top-left' | 'left-center' | 'bottom-left' | 'bottom-center' | 'top-center' | 
{  
  top?: string | number
  right?: string | number
  bottom?: string | number
  left?: string | number
  transition?: 'slide-right' | 'slide-left' | 'slide-up' | 'slide-down' | 'fade'
  transform?: string
}

const OFFSET_VALUE = '3vh'

const getPositionProps = (position : PositionProps) => {

  if (typeof position !== 'string') {
    return {
      top: position.top,
      right: position.right,
      bottom: position.bottom,
      left: position.left
    }
  }

  switch (position) {
    case 'top-right':
      return {
        top: OFFSET_VALUE,
        right: OFFSET_VALUE
      }
    case 'right-center':
      return {
        top: '50%',
        right: OFFSET_VALUE, 
      
      }
    case 'bottom-right':
      return {
        bottom: OFFSET_VALUE,
        right: OFFSET_VALUE
      }
    case 'top-left':
      return {
        top: OFFSET_VALUE,
        left: OFFSET_VALUE
      }
    case 'left-center':
      return {
        top: '50%',
        left: OFFSET_VALUE
      }
    case 'bottom-left':
      return {
        bottom: OFFSET_VALUE,
        left: OFFSET_VALUE
      }
    case 'bottom-center':
      return {
        bottom: OFFSET_VALUE,
        left: '50%'
      }
    case 'top-center':
      return {
        top: OFFSET_VALUE,
        left: '50%'
      }
  }
}

const getTranslate = (position: PositionProps) => {
  if (typeof position !== 'string') {
    return position.transform
  }

  switch (position) {
    case 'top-right':
      return 'translate(0, 0)'
    case 'right-center':
      return 'translate(0, -50%)'
    case 'bottom-right':
      return 'translate(0, 0)'
    case 'top-left':
      return 'translate(0, 0)'
    case 'left-center':
      return 'translate(0, -50%)'
    case 'bottom-left':
      return 'translate(0, 0)'
    case 'bottom-center':
      return 'translate(-50%, 0)'
    case 'top-center':
      return 'translate(-50%, 0)'
  }
}



const getTransition = (position: PositionProps) => {
  if (typeof position !== 'string') {
    return position.transition || 'slide-right'
  }

  if (position.includes('left')){
    return 'slide-right'
  } else if (position.includes('right')){
    return 'slide-left'
  } else if (position.includes('top')){
    return 'slide-down'
  } else if (position.includes('bottom')){
    return 'slide-up'
  }
} 


export { getPositionProps, getTranslate, getTransition }
