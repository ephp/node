<?php

namespace Ephp\NodeBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * ChatRoom
 *
 * @ORM\Table(name="chat_room")
 * @ORM\Entity(repositoryClass="Ephp\NodeBundle\Entity\ChatRoomRepository")
 */
class ChatRoom
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
     * @var string
     *
     * @ORM\Column(name="chatroom", type="string", length=255)
     */
    private $chatroom;

    /**
     * @var boolean
     *
     * @ORM\Column(name="private", type="boolean")
     */
    private $private;

    /**
     * @var array
     *
     * @ORM\Column(name="users", type="array")
     */
    private $users;

    /**
     * @var array
     *
     * @ORM\Column(name="alias", type="array")
     */
    private $alias;

    /**
     * @var string
     *
     * @ORM\Column(name="locale", type="string", length=8)
     */
    private $locale;

    /**
     * @var \DateTime
     *
     * @ORM\Column(name="last_message_at", type="datetime")
     */
    private $last_message_at;
    
    function __construct() {
        $this->users = array();
    }

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
     * @return ChatRoom
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
     * Set private
     *
     * @param boolean $private
     * @return ChatRoom
     */
    public function setPrivate($private)
    {
        $this->private = $private;
    
        return $this;
    }

    /**
     * Get private
     *
     * @return boolean 
     */
    public function getPrivate()
    {
        return $this->private;
    }

    /**
     * Set users
     *
     * @param array $users
     * @return ChatRoom
     */
    public function addUsers($user)
    {
        $this->users[] = $user;
    
        return $this;
    }

    /**
     * Set users
     *
     * @param array $users
     * @return ChatRoom
     */
    public function setUsers($users)
    {
        $this->users = $users;
    
        return $this;
    }

    /**
     * Get users
     *
     * @return array 
     */
    public function getUsers()
    {
        return $this->users;
    }

    /**
     * Set locale
     *
     * @param string $locale
     * @return ChatRoom
     */
    public function setLocale($locale)
    {
        $this->locale = $locale;
    
        return $this;
    }

    /**
     * Get locale
     *
     * @return string 
     */
    public function getLocale()
    {
        return $this->locale;
    }

    /**
     * Set id
     *
     * @param string $id
     * @return ChatRoom
     */
    public function setId($id)
    {
        $this->id = $id;
    
        return $this;
    }

    /**
     * Set codice
     *
     * @param string $codice
     * @return ChatRoom
     */
    public function setCodice($codice)
    {
        $this->codice = $codice;
    
        return $this;
    }

    /**
     * Get codice
     *
     * @return string 
     */
    public function getCodice()
    {
        return $this->codice;
    }

    /**
     * Set alias
     *
     * @param array $alias
     * @return ChatRoom
     */
    public function setAlias($alias)
    {
        $this->alias = $alias;
    
        return $this;
    }

    /**
     * Get alias
     *
     * @return array 
     */
    public function getAlias()
    {
        return $this->alias;
    }

    /**
     * Set last_message_at
     *
     * @param \DateTime $lastMessageAt
     * @return ChatRoom
     */
    public function setLastMessageAt($lastMessageAt)
    {
        $this->last_message_at = $lastMessageAt;
    
        return $this;
    }

    /**
     * Get last_message_at
     *
     * @return \DateTime 
     */
    public function getLastMessageAt()
    {
        return $this->last_message_at;
    }
}