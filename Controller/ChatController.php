<?php

namespace Ephp\NodeBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

/**
 * @Route("/chat")
 */
class ChatController extends Controller {

    /**
     * @Route("notifica", name="chat_notifica")
     * @Template()
     */
    public function chatNotificaAction() {
        return array();
    }
    
    /**
     * @Route("/{chiama}/{risponde}", name="chat_2", defaults={"_format"="html"} ,requirements={"_format"="html|json"})
     * @Template()
     */
    public function chatDueAction($chiama, $risponde) {
        $user = $this->getUser();
        /* @var $user Ephp\ACLBundle\Model\BaseUser */
        $chiama = strtolower($chiama);
        $risponde = strtolower($risponde);
        $nickname = strtolower($user->getNickname());
        if($nickname != $chiama && $nickname != $risponde) {
            throw $this->createNotFoundException();
        }
        
        $out = array(
            'i' => $nickname == $chiama ? $chiama : $risponde,
            'alias' => $nickname == $risponde ? $chiama : $risponde,
            'chatroom' => $this->getChatRoomName(array($chiama, $risponde)),
        );
        
        if ($this->getRequest()->get('_format') == 'txt') {
            return $out;
        } else {
            return new \Symfony\Component\HttpFoundation\Response(json_encode($out));
        }
    }
    
    private function getChatRoomName(array $nicknames) {
        $em = $this->getEm();
        $_user = $em->getRepository($this->container->getParameter('ephp_acl.user.class'));
        $m = $f = array();
        foreach ($nicknames as $nickname) {
            $user = $_user->findOneBy(array('nickname' => $nickname));
            /* @var $user \Ephp\ACLBundle\Model\BaseUser */
            if(in_array($user->getGender(), array('m', 'male', 'man', 'maschio'))) {
                $m[] = $user->getId();
            } else {
                $f[] = $user->getId();
            }
        }
        sort($f);
        sort($m);
        $fm = array_merge($f, $m);
        return implode('-', $fm);
    }

    /**
     *
     * @return \Doctrine\ORM\EntityManager
     */
    private function getEm() {
        return $this->getDoctrine()->getEntityManager();
    }

}
