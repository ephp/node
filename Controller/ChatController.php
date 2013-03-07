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
     * @Route("/{chiama}/{risponde}", name="chat_2")
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
        return array(
            'i' => $nickname == $chiama ? $chiama : $risponde,
            'you' => $nickname == $risponde ? $chiama : $risponde,
        );
    }

}
