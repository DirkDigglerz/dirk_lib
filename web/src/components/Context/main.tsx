import { IconName } from "@fortawesome/fontawesome-svg-core";
import { Image, Input, useMantineTheme } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../utils/fetchNui";
import SideBar from "../Generic/SideBar";
import { Title } from "../Generic/Title";
import { ContextItem, ContextItemProps } from "./ContextItem";
import SearchableContent from "./Searchable";

export type MenuProps = {
  title: string
  description?: string
  icon?: IconName | string
  canClose: boolean; 
  dialog?: string
  searchBar?: boolean
  menu?: string
  watermark?: string
  clickSounds: boolean
  hoverSounds: boolean
  options: ContextItemProps[]
}

export default function Menu(){
    const [menuOpen, setMenuOpen] = useState<MenuProps | false>(false)
    const [search, setSearch] = useState<string>('')
    const theme = useMantineTheme();
    
    useNuiEvent('OPEN_CONTEXT', (data: MenuProps) => {
      setMenuOpen(data)
    })

    useNuiEvent('CLOSE_CONTEXT', () => {
      setMenuOpen(false)
    })

    useNuiEvent('UPDATE_CONTEXT', (data: MenuProps) => {
      setMenuOpen(data)
    })

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    }

    useEffect(() => {
      if (!menuOpen || menuOpen.searchBar) {
        setSearch('')
      }
    }, [menuOpen])

    // handle escaape key press
    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && menuOpen && menuOpen.canClose) {
          fetchNui('CLOSE_CONTEXT')
        }
      }
      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }, [menuOpen])


    // memoise options to prevent weird re-renders
    const options = useMemo(() => {
      if (!menuOpen) return []
      return menuOpen?.options.map((option, index) => (
        <ContextItem key={index} {...option} clickSounds={menuOpen.clickSounds} hoverSounds={menuOpen.hoverSounds}/>
      ))
    } , [menuOpen])


    return (
      <>

        <SideBar 
          menuOpen={!!menuOpen} 
          setMenuOpen={(open: boolean) => setMenuOpen(open ? menuOpen || false : false)}
          escapeClose={menuOpen ? menuOpen.canClose : false}
          onClose={() => {
            fetchNui('CLOSE_CONTEXT')
          }}
          w='28vw' 
          h='100vh'
          p='xs'
          pt='xl' 
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
          {menuOpen && 
            <>
              <Title 
                title={menuOpen.title} 
                description={menuOpen.description || ''} 
                icon={menuOpen.icon as IconName} 
                
                backButton={menuOpen.menu || menuOpen.dialog ? true : false}
                onBack={() => {
                  fetchNui('CONTEXT_BACK')
                }}
              
                closeButton={menuOpen.canClose}
                onClose={() => {
                  setMenuOpen(false)
                  fetchNui('CLOSE_CONTEXT')
                }}
              />
            
              {menuOpen.searchBar &&
                  <Input 
                    w='65%'
                    size='sm'
                    radius={theme.radius.xxs}
                    styles={{
                      input:{
                        fontSize:theme.fontSizes.xs,
                        border:'1px solid var(--mantine-primary-color-9)',
                        background:'rgba(144, 144, 155, 0.5)',
                      }
                    }}
                    placeholder='Search...'
                    onChange={handleSearch}
                  />
              }

              <SearchableContent searchTerm={search}>
                {options}
              </SearchableContent>
            </>
          }

          
          {menuOpen && menuOpen.watermark && 
            <>
              <Image src={menuOpen.watermark} w='6.5vh' h='6.5vh' 
                style={{
                  position:'absolute',
                  bottom:'1rem',
                  border:'1px solid var(--mantine-primary-color-9)',
                  borderRadius:'var(--mantine-radius-sm)',
                }}
              />
            </>
          }


        </SideBar>
         
      
      </>

    )
}

{/* <Image src='https://via.placeholder.com/150x150' w='6.5vh' h='6.5vh' 
          
style={{
  position:'absolute',
  bottom:'1rem',
  border:'1px solid var(--mantine-primary-color-9)',
  borderRadius:'var(--mantine-radius-sm)',
}}
/> */}
