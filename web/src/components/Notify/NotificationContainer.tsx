import { Flex } from "@mantine/core";
import { useEffect, useState } from "react";
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

    const existingNotification = notifications.find((n) => n.title === data.title && n.description === data.description && props.position === data.position && n.icon === data.icon);
    if (existingNotification) {
      existingNotification.count = (existingNotification.count || 1) + 1;
      setNotifications([...notifications]);
      return;
    }
    setNotifications([...notifications, data]);
  });

  useNuiEvent('CLEAR_NOTIFICATIONS', () => {
    setNotifications([]);
  });

  useEffect(() => {
    // Create an array of timers for each notification
    const timers = notifications.map((notification) => {
      const hideTimer = setTimeout(() => {
        notification.hide = true;
        setNotifications((prevNotifications) => [...prevNotifications]);

        const removeTimer = setTimeout(() => {
          // remove by matching rather than index in case index changes
          setNotifications((prevNotifications) => prevNotifications.filter((n) => n !== notification));
        }, 100);

        return () => clearTimeout(removeTimer);
      }, notification.duration || 5000);

      return () => clearTimeout(hideTimer); // Dirkup for hide timer
    });

    // Dirkup timers on unmount or when notifications change
    return () => {
      timers.forEach((clearTimer) => clearTimer());
    };
  }, [notifications]);

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
        pointerEvents: 'none', // Allow clicks to pass through
        translate: getTranslate(props.position),
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {notifications.map((notification, index) => (
        <Notification {...notification} key={index} />
      ))}
    </Flex>
  );
}

export default NotificationContainer;

