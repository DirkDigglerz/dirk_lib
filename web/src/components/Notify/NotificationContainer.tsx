import { Flex } from "@mantine/core";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { getPositionProps, getTranslate, PositionProps } from "../../utils/positioning";
import Notification, { NotificationProps } from "./Notification";

export type NotificationContainerProps = {
  position: PositionProps;
}

function NotificationContainer(props: NotificationContainerProps) {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  useNuiEvent('ADD_NOTIFICATION', (data: NotificationProps) => {
    if (data.position !== props.position) return;

    const existingNotification = notifications.find(
      (n) => n.title === data.title && n.description === data.description && props.position === data.position && n.icon === data.icon
    );

    if (existingNotification) {
      existingNotification.count = (existingNotification.count || 1) + 1;
      setNotifications([...notifications]);
      return;
    }
    
    const uniqueId = `${data.title}-${data.description}-${Date.now()}`;
    data.id = uniqueId;
    setNotifications([...notifications, data]);
  });

  useNuiEvent('CLEAR_NOTIFICATIONS', () => {
    setNotifications([]);
  });

  return (
    <Flex
      direction="column"
      gap="xs"
      w="20%"
      h="fit-content"
      pos="absolute"
      {...getPositionProps(props.position)}
      style={{
        zIndex: 1000,
        pointerEvents: 'none',
        translate: getTranslate(props.position),
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <AnimatePresence>
        {notifications.map((notification) => (
          <Notification
            {...notification}
            key={notification.id}
            onRemove={() => {
              setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
            }}
          />
        ))}
      </AnimatePresence>
    </Flex>
  );
}

export default NotificationContainer;