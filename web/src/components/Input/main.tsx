import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Checkbox, ColorInput, Flex, NumberInput, Slider, Text, Textarea, TextInput, useMantineTheme } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../utils/fetchNui";
import { isEnvBrowser } from "../../utils/misc";
import SideBar from "../Generic/SideBar";
import { Title } from "../Generic/Title";
import Button from "../Generic/Button";
import { locale } from "../../stores/locales";
import { setUiTheme } from '../../stores/uiTheme';



type InputProps =
  | {
      type: 'input';
      label: string;
      description?: string;
      placeholder?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string;
      password?: boolean;
      min?: number;
      max?: number;
    }
  | {
      type: 'number';
      label: string;
      description?: string;
      placeholder?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: number;
      min?: number;
      max?: number;
      precision?: number;
      step?: number;
    }
  | {
      type: 'checkbox';
      label: string;
      description?: string;
      icon?: string;
      checked?: boolean;
      disabled?: boolean;
      required?: boolean;
    }
  | {
      type: 'select' | 'multi-select';
      label: string;
      description?: string;
      icon?: string;
      options: { value: string; label?: string }[];
      placeholder?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string | string[]; // string[] for multi-select
      clearable?: boolean;
      searchable?: boolean;
      maxSelectedValues?: number; // Only for multi-select
    }
  | {
      type: 'slider';
      label: string;
      description?: string;
      icon?: string;
      placeholder?: string;
      required?: boolean;
      disabled?: boolean;
      default?: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: 'color';
      label: string;
      description?: string;
      placeholder?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string;
      format?: 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla';
    }
  | {
      type: 'date';
      label: string;
      description?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string | true; // true defaults to current date
      format?: string;
      returnString?: boolean;
      clearable?: boolean;
      min?: string; // "01/01/2000"
      max?: string; // "12/12/2023"
    }
  | {
      type: 'date-range';
      label: string;
      description?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: [string, string];
      format?: string;
      returnString?: boolean;
      clearable?: boolean;
    }
  | {
      type: 'time';
      label: string;
      description?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string;
      format?: '12' | '24';
      clearable?: boolean;
    }
  | {
      type: 'textarea';
      label: string;
      description?: string;
      placeholder?: string;
      icon?: string;
      required?: boolean;
      disabled?: boolean;
      default?: string;
      min?: number;
      max?: number;
      autosize?: boolean; // If true, textarea will grow with content until max rows are reached
    }
  | string; // Will just be a normal input with this string as the label


type InfoProps = {
  title: string;
  description?: string;
  icon: string;
  prevDialog?: string;
  prevContext?: string;
  allowCancel?: boolean;
}

export default function Input(){
  const [opened, setOpened] = useState<boolean>(false)
  const [mainInfo, setMainInfo] = useState<InfoProps>({
    title: 'Input',
    description: 'Enter the description for this input?',
    icon: 'user',
    prevDialog: 'dialog_to_return_to',
    prevContext: 'menu_to_return_to',
    allowCancel: true,
  })

  const [inputs, setInputs] = useState<InputProps[]>([])
  

  useNuiEvent('OPEN_INPUT_DIALOG', (data: {info: InfoProps, inputs: InputProps[]}) => {
    // Whose colours this belongs to. `App` wraps this component in <Themed>,
    // so the whole thing — body and hooks included — renders in the calling
    // resource's palette.
    setUiTheme('input', (data as unknown as { theme?: never })?.theme);

    setMainInfo(data.info)
    setInputs(data.inputs)
    setOpened(true)
  })

  useNuiEvent('CLOSE_INPUT_DIALOG', () => {
    setOpened(false)
  })

  const form = useForm()

  const theme = useMantineTheme();

  return (
    <SideBar
      menuOpen={opened}
      setMenuOpen={() => {setOpened(!opened)}}
      escapeClose={mainInfo.allowCancel}
      onClose={() => {
        fetchNui('INPUT_DIALOG_SUBMIT')
      }}
      w='28vw' 
      h='100vh' 
      pt='12vh'
      style={{
        // backdropFilter: 'blur(2px)',
        display:'flex',
        padding:theme.spacing.lg,
        flexDirection:'column',
        // justifyContent:'center',
        alignItems:'center',
        gap:theme.spacing.sm,
        userSelect:'none',

      }}  
    >
      <Title
        title={mainInfo.title}
        description={mainInfo.description || ''}
        icon={mainInfo.icon}
        backButton={
          mainInfo.prevContext || mainInfo.prevDialog ? true : false
        } 

        onBack={() => {
          fetchNui('INPUT_GO_BACK',{
            prevContext: mainInfo.prevContext,
            prevDialog: mainInfo.prevDialog
          })
        }}


        closeButton={mainInfo.allowCancel}
        onClose={() => {
          setOpened(false)
          fetchNui('INPUT_DIALOG_SUBMIT')
        }}
      />

      <form
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',          
          marginBottom: '2rem',
          alignItems: 'center',

        }}
      >
        <Flex
          direction='column'
          w='100%'
          gap='xs'
          style={{
            scrollbarGutter: 'stable',
            overflowY: 'auto',
            maxHeight: '70vh',
            padding: theme.spacing.xs,
          }}
        >
          {inputs.map((input, index) => (
            typeof input === 'object' ? <CustomInput key={index} {...input} 
              onChanged={(value) => {
                form.setFieldValue(input.label, value)
              }}
            /> : <CustomInput key={index} label={input} type="input" 
              onChanged={(value) => {
                form.setFieldValue(input, value)
              }}
            />
          ))}
        </Flex>

        <Flex
          gap='xs'
          w='90%'
          justify='space-between'
        >
          <Button
    
            flex={1}
            rect 
            text={locale('Cancel')}
          />
          <Button
            rect 
            text={locale('Submit')}
            flex={1}
            onClick={() => {

              // confirm all required fields are filled
              // send data to server
              inputs.forEach(input => {
                if (typeof input !== 'string' && input.required && !form.values[input.label]){
                  return
                }
              })  
              if (isEnvBrowser()) return 
              setOpened(false)
              fetchNui('INPUT_DIALOG_SUBMIT', form.values)
            }}
          />
        </Flex>
      </form>

    </SideBar>
  )
}

function CustomInput(props: InputProps & {onChanged?: (value: unknown) => void}){
  const isSimple = function(input: InputProps): input is string {
    return typeof input === 'string'
  }
  const theme = useMantineTheme();
  return (
    <Flex
      direction='column'
      gap='0.5rem'
      w='100%'
      p='xs'
      bg='rgba(77,77,77,0.5)'
      style={{
        borderRadius: theme.radius.xxs,
        filter: 'drop-shadow(0px 0px 5px rgba(0,0,0,0.5))',
      }}
    >
      <Flex
        direction='column'
      >
        <Flex
          align='center'
          gap='xs'
        >
          {typeof props !== 'string' && props.icon && <FontAwesomeIcon icon={props.icon as IconProp} style={{fontSize:theme.fontSizes.xs}} />}

          <Text
          
            style={{
              color: 'white',
              fontFamily: 'Akrobat Bold',
              fontSize: '1.8vh',
            }}
          >{isSimple(props) ? props : props.label}</Text>
        </Flex>
        {/* description if there is one */}
        {typeof props !== 'string' && props.description && <Text
          size='xs'
          c='rgba(255,255,255,0.8)'
        >{props.description}</Text>}
      </Flex>
      <Flex
        direction={'column'}
        w='100%'
        align='center'

      >
        {isSimple(props) ? 
          <TextInput  
            radius='xxs'
            onChange={(e) => {
              props.onChanged && props.onChanged(e.currentTarget.value)
            }}
          />
        : props.type === 'input' ?
          <TextInput    radius='xxs' w='100%' placeholder={props.placeholder} required={props.required} disabled={props.disabled} defaultValue={props.default} type={props.password ? 'password' : 'text'} min={props.min} max={props.max} 
            onChange={(e) => {
              props.onChanged && props.onChanged(e.currentTarget.value)
            }}
          />
        : props.type === 'number' ?
          <NumberInput w='100%'    radius='xxs' placeholder={props.placeholder} required={props.required} disabled={props.disabled} defaultValue={props.default} min={props.min} max={props.max} step={props.step} 
            onChange={(e) => {
              props.onChanged && props.onChanged(e)
            }}
          />
        : props.type === 'checkbox' ?
          <Checkbox checked={props.checked} disabled={props.disabled} required={props.required}  radius='xxs'
          size='md'
            onChange={(e) => {
              props.onChanged && props.onChanged(e.currentTarget.checked)
            }}
          />
        : props.type === 'color' ?
          <ColorInput placeholder={props.placeholder} required={props.required} disabled={props.disabled} defaultValue={props.default} format={props.format} 
            onChange={(e) => {
              props.onChanged && props.onChanged(e) 
            }}

          />
        // : props.type === 'select' ?
        //   <Select placeholder={props.placeholder} required={props.required} disabled={props.disabled} data={props.options} searchable={props.searchable} clearable={props.clearable} maxSelectedValues={props.maxSelectedValues} />
        // : props.type === 'multi-select' ?
        //   <MultiSelect placeholder={props.placeholder} required={props.required} disabled={props.disabled} data={props.options} searchable={props.searchable} clearable={props.clearable} maxSelectedValues={props.maxSelectedValues} />
        : props.type === 'textarea' ?
          <Textarea placeholder={props.placeholder} required={props.required} disabled={props.disabled} defaultValue={props.default} autosize={props.autosize} resize={'both'}
            onChange={(e) => {
              props.onChanged && props.onChanged(e.currentTarget.value)
            }}
          />
        // : props.type === 'date-range' ?
        //   <DateInput 
          
        //     placeholder={props.placeholder} 
        //     required={props.required} 
        //     disabled={props.disabled} 
        //     clearable={props.clearable} 
        //     min={props.min} 
        //     max={props.max}
        //   />
        // : props.type === 'date' ?
        //   <DateInput 
        //     placeholder={props.placeholder} 
        //     required={props.required} 
        //     disabled={props.disabled} 
        //     clearable={props.clearable} 
        //     min={props.min} 
        //     max={props.max}
        //   />
        : props.type === 'slider' ?
          <Slider w='100%' defaultValue={props.default} min={props.min} max={props.max} 
            radius='xxs'
            styles={{
              thumb: {
                aspectRatio: 1,
              },
              label: {
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.xxs,
                backgroundColor: 'rgba(0,0,0,0.5)',
                bottom: 'calc(100% + 0.5vh)',
                aspectRatio: '1/1',
                fontSize: '1vh',
            
              }
            }}
            onChange={(e) => {
              props.onChanged && props.onChanged(e)
            }}
          />
        : null}
      </Flex>

    </Flex>
  )
}

