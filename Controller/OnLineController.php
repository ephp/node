<?php

namespace Ephp\NodeBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

/**
 * @Route("/online")
 */
class OnLineController extends Controller {

    /**
     * @Route("all", name="online_all")
     * @Template()
     */
    public function chatNotificaAction() {
        return array();
    }
    

    /**
     *
     * @return \Doctrine\ORM\EntityManager
     */
    private function getEm() {
        return $this->getDoctrine()->getEntityManager();
    }

}
