<?php

namespace Ephp\NodeBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Chat
 *
 * @ORM\Table(name="chat_notify")
 * @ORM\Entity(repositoryClass="Ephp\NodeBundle\Entity\ChatNotifyRepository")
 */
class ChatNotify
{
    /**
     * @ORM\ManyToOne(targetEntity="ChatRoom")
     * @ORM\Id
     * @ORM\JoinColumn(name="chatroom_id", referencedColumnName="id")
     */
    private $chatroom;

    /**
     * @ORM\ManyToOne(targetEntity="Ephp\ACLBundle\Entity\User")
     * @ORM\Id
     * @ORM\JoinColumn(name="user_id", referencedColumnName="id")
     */
    private $user;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="notify_at", type="datetime")
     */
    private $notify_at;

    /**
     * @var string
     *
     * @ORM\Column(name="messages", type="array")
     */
    private $messages;

    /**
     * @var integer
     *
     * @ORM\Column(name="notified", type="boolean", nullable=true)
     */
    private $notified;


    /**
     * Get id
     *
     * @return integer 
     */
    public function getId()
    {
        return $this->id;
    }

    /**
     * Set chatroom
     *
     * @param string $chatroom
     * @return Chat
     */
    public function setChatroom($chatroom)
    {
        $this->chatroom = $chatroom;
    
        return $this;
    }

    /**
     * Get chatroom
     *
     * @return string 
     */
    public function getChatroom()
    {
        return $this->chatroom;
    }

    /**
     * Set user
     *
     * @param string $user
     * @return Chat
     */
    public function setUser($user)
    {
        $this->user = $user;
    
        return $this;
    }

    /**
     * Get user
     *
     * @return string 
     */
    public function getUser()
    {
        return $this->user;
    }

    /**
     * Set send_at
     *
     * @param \DateTime $sendAt
     * @return Chat
     */
    public function setNotfyAt($sendAt)
    {
        $this->notify_at = $sendAt;
    
        return $this;
    }

    /**
     * Get send_at
     *
     * @return \DateTime 
     */
    public function getNotifyAt()
    {
        return $this->notify_at;
    }

    /**
     * Set message
     *
     * @param string $message
     * @return Chat
     */
    public function setMessages($message)
    {
        $this->messages = $message;
    
        return $this;
    }

    /**
     * Get message
     *
     * @return string 
     */
    public function getMessages()
    {
        return $this->messages;
    }


    /**
     * Set notify_at
     *
     * @param \DateTime $notifyAt
     * @return ChatNotify
     */
    public function setNotifyAt($notifyAt)
    {
        $this->notify_at = $notifyAt;
    
        return $this;
    }

    /**
     * Set to_notify
     *
     * @param boolean $toNotify
     * @return ChatNotify
     */
    public function setNotified($toNotify)
    {
        $this->notified = $toNotify;
    
        return $this;
    }

    /**
     * Get to_notify
     *
     * @return boolean 
     */
    public function getNotified()
    {
        return $this->notified;
    }
}