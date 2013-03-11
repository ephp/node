<?php

namespace Ephp\NodeBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Chat
 *
 * @ORM\Table(name="chat_messages")
 * @ORM\Entity(repositoryClass="Ephp\NodeBundle\Entity\ChatRepository")
 */
class Chat
{
    /**
     * @var integer
     *
     * @ORM\Column(name="id", type="string", length=36)
     * @ORM\Id
     * @ORM\GeneratedValue(strategy="NONE")
     */
    private $id;

    /**
     * @ORM\ManyToOne(targetEntity="ChatRoom")
     * @ORM\JoinColumn(name="chatroom_id", referencedColumnName="id")
     */
    private $chatroom;

    /**
     * @ORM\ManyToOne(targetEntity="Ephp\ACLBundle\Entity\User")
     * @ORM\JoinColumn(name="user_id", referencedColumnName="id")
     */
    private $user;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="send_at", type="datetime")
     */
    private $send_at;

    /**
     * @var string
     *
     * @ORM\Column(name="message", type="text")
     */
    private $message;

    /**
     * @var integer
     *
     * @ORM\Column(name="abuse", type="integer", nullable=true)
     */
    private $abuse;


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
    public function setSendAt($sendAt)
    {
        $this->send_at = $sendAt;
    
        return $this;
    }

    /**
     * Get send_at
     *
     * @return \DateTime 
     */
    public function getSendAt()
    {
        return $this->send_at;
    }

    /**
     * Set message
     *
     * @param string $message
     * @return Chat
     */
    public function setMessage($message)
    {
        $this->message = $message;
    
        return $this;
    }

    /**
     * Get message
     *
     * @return string 
     */
    public function getMessage()
    {
        return $this->message;
    }

    /**
     * Set abuse
     *
     * @param integer $abuse
     * @return Chat
     */
    public function setAbuse($abuse)
    {
        $this->abuse = $abuse;
    
        return $this;
    }

    /**
     * Get abuse
     *
     * @return integer 
     */
    public function getAbuse()
    {
        return $this->abuse;
    }
}